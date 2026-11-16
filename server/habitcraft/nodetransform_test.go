package habitcraft

import (
	"encoding/json"
	"os"
	"strconv"
	"testing"
)

// The gate for the legacy-password fallback (habitcraft-ti91): the port must
// turn every password into exactly what the Node backend hashed. The fixture
// was written by the real js-xss through backend/middleware/sanitize.js, by
// scripts/password-transform-fixture.js. This test reads only the fixture, so
// it keeps its proof after backend/ is deleted.
func TestNodeTransformMatchesTheNodeBackend(t *testing.T) {
	raw, err := os.ReadFile("testdata/node-password-transform.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		XSSVersion string `json:"xssVersion"`
		Rows       []struct {
			In  string `json:"in"`
			Out string `json:"out"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Rows) < 300 {
		t.Fatalf("only %d rows: the fixture has lost its corpus", len(fixture.Rows))
	}

	failures := 0
	for i, row := range fixture.Rows {
		if got := nodeTransform(row.In); got != row.Out {
			failures++
			if failures <= 20 {
				t.Errorf("row %d: nodeTransform(%s) = %s, js-xss %s gives %s",
					i, strconv.Quote(row.In), strconv.Quote(got), fixture.XSSVersion, strconv.Quote(row.Out))
			}
		}
	}
	if failures > 0 {
		t.Errorf("%d of %d rows differ", failures, len(fixture.Rows))
	}
}

// JavaScript's trim() is not strings.TrimSpace: it keeps U+0085 and strips
// U+FEFF. The fixture covers this too; this names the difference.
func TestJSTrimIsNotTrimSpace(t *testing.T) {
	for in, want := range map[string]string{
		"\U00000085x\U00000085":           "\U00000085x\U00000085",
		"\U0000FEFFx\U0000FEFF":           "x",
		"\U000000A0\U00003000x\U00002029": "x",
		"\U0000180Ex":                     "\U0000180Ex",
		"":                                "",
		" \t\n ":                          "",
	} {
		if got := jsTrim(in); got != want {
			t.Errorf("jsTrim(%q) = %q, want %q", in, got, want)
		}
	}
}
