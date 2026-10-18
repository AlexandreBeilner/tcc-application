import { describe, expect, it } from 'vitest'
import { nextStreak, streakMilestone } from '.'

describe('nextStreak', () => {
    it.each([
        { streak: 0, answer: { correct: true, firstTry: true }, expected: 1 },
        { streak: 4, answer: { correct: true, firstTry: true }, expected: 5 },
        { streak: 4, answer: { correct: false, firstTry: false }, expected: 0 },
        { streak: 4, answer: { correct: true, firstTry: false }, expected: 0 },
        { streak: 0, answer: { correct: false, firstTry: false }, expected: 0 },
    ])('de $streak com $answer vai a $expected', ({ streak, answer, expected }) => {
        expect(nextStreak(streak, answer)).toBe(expected)
    })
})

describe('streakMilestone', () => {
    it.each([
        { streak: 0, expected: undefined },
        { streak: 2, expected: undefined },
        { streak: 3, expected: 3 },
        { streak: 4, expected: undefined },
        { streak: 5, expected: 5 },
        { streak: 6, expected: undefined },
        { streak: 10, expected: undefined },
    ])('sequência $streak dá selo $expected', ({ streak, expected }) => {
        expect(streakMilestone(streak)).toBe(expected)
    })
})
