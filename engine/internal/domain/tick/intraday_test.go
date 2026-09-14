package tick

import "testing"

func TestIntradayRounds_CountAlwaysWithinRange(t *testing.T) {
	for seed := int64(0); seed < 50; seed++ {
		for dayIndex := 0; dayIndex < 50; dayIndex++ {
			rounds := IntradayRounds(seed, dayIndex)
			if len(rounds) < 1 || len(rounds) > 4 {
				t.Fatalf("seed=%d dayIndex=%d: got %d rounds, want between 1 and 4", seed, dayIndex, len(rounds))
			}
		}
	}
}

func TestIntradayRounds_DistributionBiasedTowards2And3(t *testing.T) {
	counts := make(map[int]int)
	const samples = 5000
	for dayIndex := 0; dayIndex < samples; dayIndex++ {
		rounds := IntradayRounds(42, dayIndex)
		counts[len(rounds)]++
	}

	for _, count := range []int{1, 2, 3, 4} {
		if counts[count] == 0 {
			t.Fatalf("count %d never sorted across %d samples, want every count 1-4 to appear", count, samples)
		}
	}

	twoAndThree := counts[2] + counts[3]
	oneAndFour := counts[1] + counts[4]
	if twoAndThree <= oneAndFour {
		t.Fatalf("distribution not biased towards 2-3: counts=%v (2+3=%d, 1+4=%d)", counts, twoAndThree, oneAndFour)
	}
}

func TestIntradayRounds_Deterministic(t *testing.T) {
	first := IntradayRounds(7, 3)
	second := IntradayRounds(7, 3)

	if len(first) != len(second) {
		t.Fatalf("got different round counts across calls: %d vs %d", len(first), len(second))
	}
	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("round %d differs across calls: %+v vs %+v", i, first[i], second[i])
		}
	}
}

func TestIntradayRounds_DifferentDaysProduceDifferentSchedules(t *testing.T) {
	day0 := IntradayRounds(7, 0)
	day1 := IntradayRounds(7, 1)

	if len(day0) == len(day1) && sameTimes(day0, day1) {
		t.Fatalf("day 0 and day 1 produced the exact same schedule: %+v", day0)
	}
}

func TestIntradayRounds_SequenceIndexAndTimeOfDayAreValid(t *testing.T) {
	for seed := int64(0); seed < 20; seed++ {
		for dayIndex := 0; dayIndex < 20; dayIndex++ {
			rounds := IntradayRounds(seed, dayIndex)

			lastTime := -1.0
			for i, r := range rounds {
				if r.SequenceIndex != i {
					t.Fatalf("seed=%d dayIndex=%d: round %d has SequenceIndex %d, want %d", seed, dayIndex, i, r.SequenceIndex, i)
				}
				if r.TimeOfDay < 0 || r.TimeOfDay >= 1 {
					t.Fatalf("seed=%d dayIndex=%d: round %d has TimeOfDay %f, want within [0,1)", seed, dayIndex, i, r.TimeOfDay)
				}
				if r.TimeOfDay < lastTime {
					t.Fatalf("seed=%d dayIndex=%d: rounds not sorted ascending by TimeOfDay: %+v", seed, dayIndex, rounds)
				}
				lastTime = r.TimeOfDay
			}
		}
	}
}

func sameTimes(a, b []IntradayRound) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
