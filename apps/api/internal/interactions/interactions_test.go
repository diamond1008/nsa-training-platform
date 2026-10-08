package interactions

import (
	"testing"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestIsValidChannel(t *testing.T) {
	validChannels := []db.InteractionChannel{
		db.InteractionChannelPhoneCall,
		db.InteractionChannelZalo,
		db.InteractionChannelFacebook,
		db.InteractionChannelEmail,
		db.InteractionChannelInPerson,
		db.InteractionChannelSms,
		db.InteractionChannelOther,
	}

	for _, ch := range validChannels {
		if !isValidChannel(ch) {
			t.Errorf("expected channel %s to be valid", ch)
		}
	}

	if isValidChannel("carrier_pigeon") {
		t.Error("expected invalid channel to be rejected")
	}
}
