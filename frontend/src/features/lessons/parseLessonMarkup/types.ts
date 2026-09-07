export interface TextSegment {
    type: 'text'
    value: string
}

export interface TermSegment {
    type: 'term'
    term: string
    definition: string
}

export interface RefSegment {
    type: 'ref'
    code: string
}

export type Segment = TextSegment | TermSegment | RefSegment
