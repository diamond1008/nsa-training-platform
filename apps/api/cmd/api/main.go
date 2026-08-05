// Command api runs the NSA Training Platform HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/assessments"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/attendance"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/classes"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/completions"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/courses"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/notifications"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/config"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/database"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/docs"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/health"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/logging"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/middleware"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/progress"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/reports"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/schedules"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/students"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/teachers"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/testscores"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "api:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log := logging.New(cfg.Env, cfg.LogLevel)
	slog.SetDefault(log)

	// Cancel on SIGINT/SIGTERM for graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	pool, err := database.Connect(connectCtx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer pool.Close()
	log.Info("connected to database")

	healthHandler := health.NewHandler(pool)
	docsHandler := docs.NewHandler(cfg.OpenAPIPath)

	// Authentication (Phase 3).
	tokenService, err := auth.NewTokenService(cfg.JWTAccessSecret, cfg.AccessTokenTTL)
	if err != nil {
		return fmt.Errorf("token service: %w", err)
	}
	authService, err := auth.NewService(db.New(pool), tokenService, cfg.RefreshTokenTTLDays, cfg.BcryptCost, log)
	if err != nil {
		return fmt.Errorf("auth service: %w", err)
	}
	authHandler := auth.NewHandler(authService, log, cfg.Env != "development")

	// Business modules (Phases 4-6).
	studentHandler := students.NewHandler(students.NewService(pool, cfg.BcryptCost), log)
	teacherHandler := teachers.NewHandler(teachers.NewService(pool, cfg.BcryptCost), log)
	courseHandler := courses.NewHandler(courses.NewService(pool), log)
	classHandler := classes.NewHandler(classes.NewService(pool), log)
	scheduleHandler := schedules.NewHandler(schedules.NewService(pool), log)
	attendanceService := attendance.NewService(pool)
	attendanceHandler := attendance.NewHandler(attendanceService, log)
	go attendanceService.RunAutoLockWorker(ctx, log)
	assessmentHandler := assessments.NewHandler(assessments.NewService(pool), log)
	progressHandler := progress.NewHandler(progress.NewService(pool), log)
	completionHandler := completions.NewHandler(completions.NewService(pool), log)
	notificationHandler := notifications.NewHandler(notifications.NewService(pool), log)
	reportHandler := reports.NewHandler(reports.NewService(pool), log)
	testScoreHandler := testscores.NewHandler(testscores.NewService(pool), log)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.RequestLog(log))
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Operational endpoints (unversioned by design).
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// API documentation (Swagger UI + the OpenAPI contract).
	r.Get("/docs", docsHandler.SwaggerUI)
	r.Get("/openapi.yaml", docsHandler.OpenAPISpec)

	// Business API (versioned).
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/certificates/{verificationCode}", completionHandler.Verify)
		r.Route("/auth", func(r chi.Router) {
			// Brute-force protection on credential endpoints (in-memory, per IP).
			r.With(httprate.LimitByIP(10, time.Minute)).Post("/login", authHandler.Login)
			r.With(httprate.LimitByIP(20, time.Minute)).Post("/refresh", authHandler.Refresh)
			r.Post("/logout", authHandler.Logout)

			// Requires a valid access token.
			r.Group(func(r chi.Router) {
				r.Use(auth.Authenticate(tokenService))
				r.Post("/change-password", authHandler.ChangePassword)
				r.Get("/me", authHandler.Me)
			})
		})

		mountAdminRoutes(
			r, tokenService, studentHandler, teacherHandler, courseHandler,
			classHandler, scheduleHandler, attendanceHandler, completionHandler, reportHandler,
			testScoreHandler,
		)
		mountRoleRoutes(
			r, tokenService, classHandler, scheduleHandler, attendanceHandler,
			assessmentHandler, progressHandler, completionHandler,
			testScoreHandler,
		)
		r.Route("/notifications", func(r chi.Router) {
			r.Use(auth.Authenticate(tokenService))
			r.Get("/", notificationHandler.List)
			r.Put("/{notificationID}/read", notificationHandler.MarkRead)
			r.Delete("/{notificationID}", notificationHandler.Archive)
		})
	})

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("api listening",
			"addr", srv.Addr,
			"env", cfg.Env,
			"docs_url", fmt.Sprintf("http://localhost:%d/docs", cfg.HTTPPort),
		)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		log.Info("shutdown signal received")
	case listenErr := <-errCh:
		if !errors.Is(listenErr, http.ErrServerClosed) {
			return fmt.Errorf("listen: %w", listenErr)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	log.Info("server stopped gracefully")
	return nil
}

// mountAdminRoutes keeps every administrative endpoint behind the same
// authentication and ADMIN-role boundary.
func mountAdminRoutes(
	r chi.Router,
	tokenService *auth.TokenService,
	studentHandler *students.Handler,
	teacherHandler *teachers.Handler,
	courseHandler *courses.Handler,
	classHandler *classes.Handler,
	scheduleHandler *schedules.Handler,
	attendanceHandler *attendance.Handler,
	completionHandler *completions.Handler,
	reportHandler *reports.Handler,
	testScoreHandler *testscores.Handler,
) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(auth.Authenticate(tokenService))
		r.Use(auth.RequireRole(auth.RoleAdmin))

		r.Route("/students", func(r chi.Router) {
			r.Get("/", studentHandler.List)
			r.Post("/", studentHandler.Create)
			r.Get("/export", studentHandler.ExportCSV)
			r.Post("/import", studentHandler.ImportCSV)
			r.Get("/{studentID}", studentHandler.Get)
			r.Put("/{studentID}", studentHandler.Update)
			r.Get("/{studentID}/profile-summary", studentHandler.ProfileSummary)
			r.Get("/{studentID}/class-history", studentHandler.ClassHistory)
			r.Get("/{studentID}/schedule", scheduleHandler.AdminStudentSchedule)
			r.Get("/{studentID}/status-history", studentHandler.StatusHistory)
			r.Get("/{studentID}/attendance-breakdown", studentHandler.AttendanceBreakdown)
			r.Get("/{studentID}/classes/{classID}/attendance", studentHandler.ClassSessionAttendance)
			r.Get("/{studentID}/academic-summary", studentHandler.AcademicSummary)
			r.Get("/{studentID}/audit-logs", studentHandler.AuditLogs)
			r.Patch("/{studentID}/account-status", studentHandler.UpdateAccountStatus)
		})

		r.Route("/teachers", func(r chi.Router) {
			r.Get("/", teacherHandler.List)
			r.Post("/", teacherHandler.Create)
			r.Get("/{teacherID}", teacherHandler.Get)
			r.Put("/{teacherID}", teacherHandler.Update)
			r.Get("/{teacherID}/profile-summary", teacherHandler.ProfileSummary)
			r.Get("/{teacherID}/class-history", teacherHandler.ClassHistory)
			r.Get("/{teacherID}/workload-summary", teacherHandler.WorkloadSummary)
			r.Get("/{teacherID}/audit-logs", teacherHandler.AuditLogs)
			r.Patch("/{teacherID}/account-status", teacherHandler.UpdateAccountStatus)
		})

		r.Route("/courses", func(r chi.Router) {
			r.Get("/", courseHandler.List)
			r.Post("/", courseHandler.Create)
			r.Get("/{courseID}", courseHandler.Get)
			r.Put("/{courseID}", courseHandler.Update)

			r.Get("/{courseID}/modules", courseHandler.ListModules)
			r.Post("/{courseID}/modules", courseHandler.CreateModule)
			r.Put("/{courseID}/modules/{moduleID}", courseHandler.UpdateModule)

			r.Get("/{courseID}/competencies", courseHandler.ListCriteria)
			r.Post("/{courseID}/competencies", courseHandler.CreateCriterion)
			r.Put("/{courseID}/competencies/{criterionID}", courseHandler.UpdateCriterion)

			r.Get("/{courseID}/tests", testScoreHandler.ListTests)
			r.Post("/{courseID}/tests", testScoreHandler.CreateTest)
			r.Put("/{courseID}/tests/{testID}", testScoreHandler.UpdateTest)
		})

		r.Route("/classes", func(r chi.Router) {
			r.Get("/", classHandler.List)
			r.Post("/", classHandler.Create)
			r.Get("/{classID}", classHandler.Get)
			r.Put("/{classID}", classHandler.Update)
			r.Get("/{classID}/operation-history", classHandler.OperationHistory)

			r.Get("/{classID}/enrollments", classHandler.ListEnrollments)
			r.Post("/{classID}/enrollments", classHandler.Enroll)
			r.Put("/{classID}/enrollments/{enrollmentID}", classHandler.UpdateEnrollment)
			r.Post("/{classID}/enrollments/{enrollmentID}/transfer", classHandler.TransferEnrollment)

			r.Get("/{classID}/teacher-assignments", classHandler.ListAssignments)
			r.Post("/{classID}/teacher-assignments", classHandler.AssignTeacher)
			r.Put("/{classID}/teacher-assignments/{assignmentID}", classHandler.UpdateAssignment)
			r.Delete("/{classID}/teacher-assignments/{assignmentID}", classHandler.DeleteAssignment)
		})

		r.Route("/locations", func(r chi.Router) {
			r.Get("/", scheduleHandler.ListLocations)
			r.Post("/", scheduleHandler.CreateLocation)
			r.Get("/{locationID}", scheduleHandler.GetLocation)
			r.Put("/{locationID}", scheduleHandler.UpdateLocation)
		})

		r.Route("/sessions", func(r chi.Router) {
			r.Get("/", scheduleHandler.ListAdminSessions)
			r.Post("/", scheduleHandler.CreateSession)
			r.Get("/{sessionID}", scheduleHandler.GetSession)
			r.Put("/{sessionID}", scheduleHandler.UpdateSession)
			r.Get("/{sessionID}/attendance", attendanceHandler.AdminSession)
			r.Post("/{sessionID}/students/{studentID}/attendance", attendanceHandler.AdminCorrectStudent)
		})

		r.Put("/attendance/{attendanceID}", attendanceHandler.Correct)
		r.Put("/test-attempts/{attemptID}", testScoreHandler.CorrectAdmin)
		r.Get("/test-attempts/{attemptID}/history", testScoreHandler.History)

		r.Get("/completions", completionHandler.List)
		r.Put("/completions/{classID}/{studentID}", completionHandler.Decide)
		r.Get("/completions/{classID}/{studentID}/history", completionHandler.History)
		r.Get("/certificates/{certificateID}/pdf", completionHandler.AdminPDF)
		r.Post("/certificates/{certificateID}/revoke", completionHandler.Revoke)
		r.Post("/certificates/{certificateID}/reissue", completionHandler.Reissue)
		r.Get("/reports/summary", reportHandler.Summary)
		r.Get("/reports/{reportKind}.csv", reportHandler.Export)
	})
}

// mountRoleRoutes exposes only the authenticated teacher's or student's data.
func mountRoleRoutes(
	r chi.Router,
	tokenService *auth.TokenService,
	classHandler *classes.Handler,
	scheduleHandler *schedules.Handler,
	attendanceHandler *attendance.Handler,
	assessmentHandler *assessments.Handler,
	progressHandler *progress.Handler,
	completionHandler *completions.Handler,
	testScoreHandler *testscores.Handler,
) {
	r.Route("/teacher", func(r chi.Router) {
		r.Use(auth.Authenticate(tokenService))
		r.Use(auth.RequireRole(auth.RoleTeacher))
		r.Get("/classes", classHandler.ListTeacherClasses)
		r.Get("/classes/{classID}", classHandler.GetTeacherClass)
		r.Get("/schedule", scheduleHandler.TeacherSchedule)
		r.Get("/sessions/{sessionID}/attendance", attendanceHandler.TeacherSession)
		r.Post("/sessions/{sessionID}/attendance", attendanceHandler.RecordBatch)
		r.Get("/classes/{classID}/students/{studentID}/assessments", assessmentHandler.ListTeacher)
		r.Post("/classes/{classID}/students/{studentID}/assessments", assessmentHandler.Create)
		r.Get("/assessments/{assessmentID}", assessmentHandler.GetTeacher)
		r.Put("/assessments/{assessmentID}", assessmentHandler.Update)
		r.Post("/assessments/{assessmentID}/submit", assessmentHandler.Submit)
		r.Post("/assessments/{assessmentID}/lock", assessmentHandler.Lock)
		r.Get("/classes/{classID}/students/{studentID}/test-results", testScoreHandler.TeacherResults)
		r.Post("/classes/{classID}/students/{studentID}/tests/{testID}/attempts", testScoreHandler.RecordAttempt)
		r.Put("/test-attempts/{attemptID}", testScoreHandler.CorrectTeacher)
		r.Get("/test-attempts/{attemptID}/history", testScoreHandler.TeacherHistory)
	})
	r.Route("/student", func(r chi.Router) {
		r.Use(auth.Authenticate(tokenService))
		r.Use(auth.RequireRole(auth.RoleStudent))
		r.Get("/schedule", scheduleHandler.StudentSchedule)
		r.Get("/sessions/{sessionID}/attendance", attendanceHandler.StudentSession)
		r.Get("/attendance", attendanceHandler.StudentHistory)
		r.Get("/attendance/summary", attendanceHandler.StudentSummary)
		r.Get("/assessments", assessmentHandler.ListStudent)
		r.Get("/assessments/{assessmentID}", assessmentHandler.GetStudent)
		r.Get("/test-results", testScoreHandler.StudentResults)
		r.Get("/progress", progressHandler.Dashboard)
		r.Get("/certificates", completionHandler.StudentList)
		r.Get("/certificates/{certificateID}/pdf", completionHandler.StudentPDF)
	})
}
