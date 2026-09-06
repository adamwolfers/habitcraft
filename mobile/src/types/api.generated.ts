/**
 * GENERATED FILE -- DO NOT EDIT.
 *
 * Derived from shared/api-spec/openapi.yaml (version 1.0.0) by
 * scripts/api-codegen.js. Change the spec and regenerate:
 *
 *   npm run api:codegen
 *
 * CI fails if this file does not match what the spec produces.
 */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health check
         * @description Reports service liveness and database connectivity. Returns 503 (not an
         *     error body) when the database probe fails, so load balancers can read
         *     the same shape either way.
         */
        get: operations["healthCheck"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hello": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Hello World endpoint
         * @description Simple hello world response for smoke testing
         */
        get: operations["helloWorld"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register new user
         * @description Create a new user account. On success, sets HttpOnly cookies
         *     (accessToken, 15 min; refreshToken, 7 days) AND returns both tokens in
         *     the body -- the body copies exist for the mobile client, which has no
         *     cookie jar.
         */
        post: operations["register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login user
         * @description Authenticate with email and password. Sets HttpOnly cookies and returns
         *     both tokens in the body (see /api/v1/auth/register).
         */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh access token
         * @description Exchange the refresh token (cookie or body) for a new pair. Rotates:
         *     the presented refresh token is revoked and a new access AND refresh
         *     token are issued, set as cookies and returned in the body.
         */
        post: operations["refreshToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout user
         * @description Revoke the refresh token and clear authentication cookies. Always 200 --
         *     logging out with no token is not an error.
         */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get current user profile */
        get: operations["getCurrentUser"];
        /**
         * Update current user profile
         * @description Update name and/or email. At least one must be provided. Email is
         *     lowercased and checked for uniqueness.
         */
        put: operations["updateCurrentUser"];
        post?: never;
        /**
         * Delete current user account
         * @description Permanently delete the account and everything under it (completions,
         *     habits, refresh tokens) in one transaction. Requires the account
         *     password in the body as confirmation.
         */
        delete: operations["deleteCurrentUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Change password
         * @description Change the password after verifying the current one. On success every
         *     refresh token for the user is revoked, forcing re-login elsewhere.
         */
        put: operations["changePassword"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/habits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List habits
         * @description All habits for the authenticated user, each with its completions
         *     embedded. This is the ONLY response that carries the completions array;
         *     every other habit response omits it (see HabitWithCompletions).
         */
        get: operations["listHabits"];
        put?: never;
        /** Create habit */
        post: operations["createHabit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/habits/{habitId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update habit */
        put: operations["updateHabit"];
        post?: never;
        /** Delete habit */
        delete: operations["deleteHabit"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/habits/{habitId}/completions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List completions */
        get: operations["listCompletions"];
        put?: never;
        /** Mark habit complete */
        post: operations["createCompletion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/habits/{habitId}/completions/{date}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Update completion note */
        put: operations["updateCompletionNote"];
        post?: never;
        /** Remove completion */
        delete: operations["deleteCompletion"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Health: {
            /** @example habittracker-api */
            service: string;
            /** @example 1.0.0 */
            version: string;
            /** @enum {string} */
            status: "healthy";
            /** Format: date-time */
            timestamp: string;
            /** @enum {string} */
            database: "connected";
        };
        UnhealthyHealth: {
            service: string;
            version: string;
            /** @enum {string} */
            status: "unhealthy";
            /** Format: date-time */
            timestamp: string;
            /** @enum {string} */
            database: "disconnected";
            /** @description The database driver's error message */
            error: string;
        };
        Message: {
            message: string;
        };
        User: {
            /**
             * Format: uuid
             * @example 123e4567-e89b-12d3-a456-426614174000
             */
            id: string;
            /**
             * Format: email
             * @example user@example.com
             */
            email: string;
            /** @example John Doe */
            name: string;
            /** Format: date-time */
            createdAt: string;
        };
        /**
         * @description Register/login response. The tokens are BOTH set as HttpOnly cookies and
         *     returned here: the web client reads the cookies and ignores these, the
         *     mobile client has no cookie jar and reads these.
         */
        AuthResponse: {
            user: components["schemas"]["User"];
            accessToken: string;
            refreshToken: string;
        };
        TokenPair: {
            accessToken: string;
            refreshToken: string;
        };
        HabitInput: {
            /** @example Morning Exercise */
            name: string;
            /** @example 30 minutes of cardio exercise */
            description?: string | null;
            /** @example #3B82F6 */
            color?: string;
            /** @example 🏃 */
            icon?: string;
            /** @enum {string} */
            status?: "active" | "archived";
        };
        /**
         * @description A habit as returned by the single-habit and write endpoints. It has NO
         *     completions field -- only GET /api/v1/habits embeds those, and that
         *     response uses HabitWithCompletions.
         */
        Habit: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            name: string;
            description: string | null;
            color: string;
            icon: string;
            /** @enum {string} */
            status: "active" | "archived";
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /**
         * @description A habit with its completions embedded, as returned by GET
         *     /api/v1/habits. Each element of `completions` is byte-identical to what
         *     /api/v1/habits/{habitId}/completions returns for the same row -- one
         *     entity, one wire shape (habitcraft-34d.1).
         *
         *     Spelled out in full rather than as `allOf: [Habit, ...]`: under JSON
         *     Schema, `additionalProperties: false` inside an allOf branch is
         *     evaluated against the whole object, so the Habit branch would reject
         *     `completions` and nothing could ever validate.
         */
        HabitWithCompletions: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            name: string;
            description: string | null;
            color: string;
            icon: string;
            /** @enum {string} */
            status: "active" | "archived";
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            completions: components["schemas"]["Completion"][];
        };
        Completion: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            habitId: string;
            /**
             * Format: date
             * @example 2024-01-15
             */
            date: string;
            /** @example Went for a 30-minute run */
            notes: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        CompletionDeleted: {
            message: string;
            habitId: string;
            /** Format: date */
            date: string;
        };
        /** @description The bare error shape used by the auth, user and completion routes. */
        Error: {
            /** @example Habit not found */
            error: string;
        };
        /**
         * @description An error with a human-readable detail but no statusCode. Only the
         *     habit-limit 403 uses this; every other habits-route error is a
         *     DetailedError.
         */
        BriefError: {
            error: string;
            message: string;
        };
        /**
         * @description The error shape used by the habits routes and by every rate limiter,
         *     where statusCode is echoed in the body as well as the status line.
         */
        DetailedError: {
            /** @example Habit not found */
            error: string;
            /** @example Habit not found or access denied */
            message: string;
            /** @example 404 */
            statusCode: number;
        };
        /**
         * @description express-validator failures, as returned by the auth and user routes.
         *     `errors` holds one entry per failed field.
         */
        ValidationErrors: {
            errors: components["schemas"]["ValidationError"][];
        };
        /**
         * @description One express-validator error. `msg` is the only field always present:
         *     the "at least one field is required" check is raised by hand and
         *     carries nothing else.
         */
        ValidationError: {
            /** @example field */
            type?: string;
            /** @description The rejected value, of whatever type was submitted */
            value?: unknown;
            /** @example Invalid email format */
            msg: string;
            /** @example email */
            path?: string;
            /** @example body */
            location?: string;
        };
    };
    responses: {
        /** @description Bad request */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Request body failed validation */
        ValidationFailed: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ValidationErrors"];
            };
        };
        /** @description Missing, malformed or expired access token */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The habit exists but belongs to another user */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Access denied"
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description User not found */
        UserNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "User not found"
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Habit or completion not found */
        CompletionNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Invalid habit ID or habit body */
        HabitBadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Validation error",
                 *       "message": "name is required and must be a non-empty string",
                 *       "statusCode": 400
                 *     }
                 */
                "application/json": components["schemas"]["DetailedError"];
            };
        };
        /** @description Habit not found, or owned by another user */
        HabitNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Habit not found",
                 *       "message": "Habit not found or access denied",
                 *       "statusCode": 404
                 *     }
                 */
                "application/json": components["schemas"]["DetailedError"];
            };
        };
        /** @description Unexpected server error */
        InternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Internal server error"
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Unexpected server error in a habits route */
        HabitInternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Internal server error",
                 *       "message": "Failed to fetch habits",
                 *       "statusCode": 500
                 *     }
                 */
                "application/json": components["schemas"]["DetailedError"];
            };
        };
        /** @description Too many requests from this IP */
        RateLimited: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": "Too many login attempts",
                 *       "message": "Too many login attempts from this IP, please try again after 15 minutes",
                 *       "statusCode": 429
                 *     }
                 */
                "application/json": components["schemas"]["DetailedError"];
            };
        };
    };
    parameters: {
        /** @description Habit identifier */
        HabitId: string;
        /** @description Completion date (YYYY-MM-DD) */
        CompletionDate: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    healthCheck: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description API is healthy and the database is reachable */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description Database probe failed */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnhealthyHealth"];
                };
            };
        };
    };
    helloWorld: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Message"];
                };
            };
        };
    };
    register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: email
                     * @example user@example.com
                     */
                    email: string;
                    /**
                     * Format: password
                     * @example SecurePass123!
                     */
                    password: string;
                    /** @example John Doe */
                    name: string;
                };
            };
        };
        responses: {
            /** @description User created successfully */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            400: components["responses"]["ValidationFailed"];
            /** @description Email already registered */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: email
                     * @example user@example.com
                     */
                    email: string;
                    /**
                     * Format: password
                     * @example SecurePass123!
                     */
                    password: string;
                };
            };
        };
        responses: {
            /** @description Login successful */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthResponse"];
                };
            };
            400: components["responses"]["ValidationFailed"];
            /** @description Invalid credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    refreshToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tokens refreshed successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            /** @description Refresh token missing */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Refresh token is required"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid, expired, or revoked refresh token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Logged out successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "message": "Logged out successfully"
                     *     }
                     */
                    "application/json": components["schemas"]["Message"];
                };
            };
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description User profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["UserNotFound"];
            500: components["responses"]["InternalError"];
        };
    };
    updateCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @example John Doe */
                    name?: string;
                    /**
                     * Format: email
                     * @example newemail@example.com
                     */
                    email?: string;
                };
            };
        };
        responses: {
            /** @description Profile updated successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            400: components["responses"]["ValidationFailed"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["UserNotFound"];
            /** @description Email already in use by another user */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Email is already in use"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            500: components["responses"]["InternalError"];
        };
    };
    deleteCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: password
                     * @description The account's current password, as confirmation
                     */
                    password: string;
                };
            };
        };
        responses: {
            /** @description Account deleted; no content returned */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Password confirmation missing */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Password confirmation required"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing/invalid access token, or wrong password */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid password"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["UserNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: password */
                    currentPassword: string;
                    /** Format: password */
                    newPassword: string;
                    /**
                     * Format: password
                     * @description Must match newPassword
                     */
                    confirmPassword: string;
                };
            };
        };
        responses: {
            /** @description Password changed successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "message": "Password changed successfully"
                     *     }
                     */
                    "application/json": components["schemas"]["Message"];
                };
            };
            400: components["responses"]["ValidationFailed"];
            /** @description Missing/invalid access token, or wrong current password */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid current password"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["UserNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listHabits: {
        parameters: {
            query?: {
                /** @description Filter by habit status */
                status?: "active" | "archived";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of habits with embedded completions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HabitWithCompletions"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            500: components["responses"]["HabitInternalError"];
        };
    };
    createHabit: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HabitInput"];
            };
        };
        responses: {
            /** @description Habit created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Habit"];
                };
            };
            400: components["responses"]["HabitBadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description Per-user habit limit reached */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Habit limit reached",
                     *       "message": "You have reached the maximum of 50 habits. Please delete or archive existing habits before creating new ones."
                     *     }
                     */
                    "application/json": components["schemas"]["BriefError"];
                };
            };
            500: components["responses"]["HabitInternalError"];
        };
    };
    updateHabit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HabitInput"];
            };
        };
        responses: {
            /** @description Habit updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Habit"];
                };
            };
            400: components["responses"]["HabitBadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["HabitNotFound"];
            500: components["responses"]["HabitInternalError"];
        };
    };
    deleteHabit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Habit deleted; no content returned */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["HabitBadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["HabitNotFound"];
            500: components["responses"]["HabitInternalError"];
        };
    };
    listCompletions: {
        parameters: {
            query?: {
                /** @description Include completions on or after this date */
                startDate?: string;
                /** @description Include completions on or before this date */
                endDate?: string;
            };
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of completions, newest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Completion"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["CompletionNotFound"];
            500: components["responses"]["InternalError"];
        };
    };
    createCompletion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: date
                     * @example 2024-01-15
                     */
                    date: string;
                    /** @example Went for a 30-minute run */
                    notes?: string | null;
                };
            };
        };
        responses: {
            /** @description Completion recorded */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Completion"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["CompletionNotFound"];
            /** @description Already completed for this date */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Habit already completed for this date"
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            500: components["responses"]["InternalError"];
        };
    };
    updateCompletionNote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
                /** @description Completion date (YYYY-MM-DD) */
                date: components["parameters"]["CompletionDate"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Note content; pass null to clear it
                     * @example Went for a 45-minute run in the park
                     */
                    notes?: string | null;
                };
            };
        };
        responses: {
            /** @description Completion note updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Completion"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["CompletionNotFound"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteCompletion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Habit identifier */
                habitId: components["parameters"]["HabitId"];
                /** @description Completion date (YYYY-MM-DD) */
                date: components["parameters"]["CompletionDate"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Completion removed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompletionDeleted"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["CompletionNotFound"];
            500: components["responses"]["InternalError"];
        };
    };
}
