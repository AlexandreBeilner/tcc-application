export interface AuthUser {
    id: string
    name: string
    email: string
    username: string
    role: 'user' | 'admin'
    onboardingCompleted: boolean
}

export interface AuthResult {
    token: string
    user: AuthUser
}

export interface RegisterInput {
    name: string
    email: string
    username: string
    password: string
}

export interface LoginInput {
    email: string
    password: string
}
