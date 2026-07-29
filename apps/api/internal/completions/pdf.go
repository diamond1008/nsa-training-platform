package completions

import (
	"fmt"
	"time"

	"github.com/signintech/gopdf"
	"golang.org/x/image/font/gofont/goregular"
)

// CertificatePDF renders a portable certificate with an embedded Unicode font.
func CertificatePDF(c CertificateView) ([]byte, error) {
	pdf := &gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4Landscape})
	pdf.AddPage()
	if err := pdf.AddTTFFontData("Go", goregular.TTF); err != nil {
		return nil, fmt.Errorf("load certificate font: %w", err)
	}

	cell := func(y, size float64, text string) error {
		if err := pdf.SetFont("Go", "", size); err != nil {
			return err
		}
		pdf.SetXY(55, y)
		return pdf.CellWithOption(&gopdf.Rect{W: 732, H: size + 12}, text, gopdf.CellOption{Align: gopdf.Center})
	}
	if err := cell(58, 16, "NSA TRAINING PLATFORM"); err != nil {
		return nil, err
	}
	if err := cell(105, 30, "CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC"); err != nil {
		return nil, err
	}
	if err := cell(175, 17, "Chứng nhận học viên"); err != nil {
		return nil, err
	}
	if err := cell(210, 28, c.StudentName); err != nil {
		return nil, err
	}
	if err := cell(252, 14, "Mã học viên: "+c.StudentCode); err != nil {
		return nil, err
	}
	if err := cell(300, 17, "đã hoàn thành khóa học"); err != nil {
		return nil, err
	}
	if err := cell(338, 24, c.CourseName+" ("+c.CourseCode+")"); err != nil {
		return nil, err
	}
	issued, _ := time.Parse(time.RFC3339Nano, c.IssuedAt)
	if issued.IsZero() {
		issued = time.Now()
	}
	if err := cell(398, 13, fmt.Sprintf("Lớp %s · Cấp ngày %s", c.ClassCode, issued.In(time.FixedZone("GMT+7", 7*60*60)).Format("02/01/2006"))); err != nil {
		return nil, err
	}
	if err := cell(452, 11, "Số chứng nhận: "+c.CertificateNumber); err != nil {
		return nil, err
	}
	if err := cell(475, 9, "Mã xác thực: "+c.VerificationCode); err != nil {
		return nil, err
	}
	return pdf.GetBytesPdfReturnErr()
}
