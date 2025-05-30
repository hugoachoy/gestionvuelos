
"use client";

import React, { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter }_next_dist_client_components_navigation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/navigation */ "(ssr)/./node_modules/next/dist/client/components/navigation.js");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/components/ui/button */ "./src/components/ui/button.tsx");
/* harmony import */ var _components_ui_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @/components/ui/input */ "./src/components/ui/input.tsx");
/* harmony import */ var _components_ui_label__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @/components/ui/label */ "./src/components/ui/label.tsx");
/* harmony import */ var _components_ui_card__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @/components/ui/card */ "./src/components/ui/card.tsx");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! next/link */ "./node_modules/next/link.js");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(next_link__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _hooks_use_toast__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @/hooks/use-toast */ "./src/hooks/use-toast.ts");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_1__]);
_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];









function LoginPage() {
    const [email, setEmail] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
    const [password, setPassword] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)("");
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
    const { login } = (0,_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_1__.useAuth)();
    const router = (0,next_dist_client_components_navigation__WEBPACK_IMPORTED_MODULE_2__.useRouter)();
    const { toast } = (0,_hooks_use_toast__WEBPACK_IMPORTED_MODULE_8__.useToast)();
    // Check for success message from signup
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{
        const params = new URLSearchParams(window.location.search);
        if (params.get("signup") === "success") {
            toast({
                title: "Registro Exitoso",
                description: "Ahora puedes iniciar sesi\xf3n con tus credenciales.",
                variant: "default"
            });
            // Clean the query param
            router.replace("/login", undefined);
        }
    }, [
        router,
        toast
    ]);
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error: loginError } = await login({
            email,
            password
        });
        setLoading(false);
        if (loginError) {
            setError(loginError.message);
        } else {
            router.push("/"); // Redirigir a la p\xe1gina principal despu\xe9s del login
        }
    };
    return /*#__PURE__*/ (0,jsx_runtime_.jsx)("div", {
        className: "flex items-center justify-center min-h-screen bg-background",
        children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.Card, {
            className: "w-full max-w-md shadow-xl",
            children: [
                /*#__PURE__*/ (0,jsx_runtime_.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.CardHeader, {
                    children: [
                        /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.CardTitle, {
                            className: "text-2xl font-bold text-center",
                            children: "Iniciar Sesi\xf3n"
                        }),
                        /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.CardDescription, {
                            className: "text-center",
                            children: "Ingresa tus credenciales para acceder a Turnos de Vuelo."
                        })
                    ]
                }),
                /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.CardContent, {
                    children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("form", {
                        onSubmit: handleSubmit,
                        className: "space-y-6",
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_label__WEBPACK_IMPORTED_MODULE_5__.Label, {
                                        htmlFor: "email",
                                        children: "Correo Electr\xf3nico"
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_4__.Input, {
                                        id: "email",
                                        type: "email",
                                        placeholder: "tu@email.com",
                                        value: email,
                                        onChange: (e)=>setEmail(e.target.value),
                                        required: true,
                                        disabled: loading
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_label__WEBPACK_IMPORTED_MODULE_5__.Label, {
                                        htmlFor: "password",
                                        children: "Contrase\xf1a"
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_4__.Input, {
                                        id: "password",
                                        type: "password",
                                        placeholder: "********",
                                        value: password,
                                        onChange: (e)=>setPassword(e.target.value),
                                        required: true,
                                        disabled: loading
                                    })
                                ]
                            }),
                            error && /*#__PURE__*/ (0,jsx_runtime_.jsx)("p", {
                                className: "text-sm text-destructive text-center",
                                children: error
                            }),
                            /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_button__WEBPACK_IMPORTED_MODULE_3__.Button, {
                                type: "submit",
                                className: "w-full",
                                disabled: loading,
                                children: loading ? "Ingresando..." : "Ingresar"
                            })
                        ]
                    })
                }),
                /*#__PURE__*/ (0,jsx_runtime_.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_6__.CardFooter, {
                    className: "flex flex-col items-center text-sm",
                    children: /*#__PURE__*/ (0,jsx_runtime_.jsxs)("p", {
                        className: "mt-2",
                        children: [
                            "\xbfNo tienes cuenta?",
                            " ",
                            /*#__PURE__*/ (0,jsx_runtime_.jsx)((next_link__WEBPACK_IMPORTED_MODULE_7___default()), {
                                href: "/signup",
                                className: "text-primary hover:underline",
                                children: "Reg\xedstrate"
                            })
                        ]
                    })
                })
            ]
        })
    });
}


/***/ }),

/***/ "(ssr)/./src/app/login/page.tsx":
/*!**************************************!*\
  !*** (ssr)/./src/app/login/page.tsx ***!
  \**************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ LoginPage)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "(ssr)/./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "(ssr)/./node_modules/react/index.js");
/* harmony import */ var _contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/contexts/AuthContext */ "(ssr)/./src/contexts/AuthContext.tsx");
/* harmony import */ var next_navigation__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next/navigation */ "(ssr)/./node_modules/next/dist/client/components/navigation.js");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @/components/ui/button */ "(ssr)/./src/components/ui/button.tsx");
/* harmony import */ var _components_ui_input__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @/components/ui/input */ "(ssr)/./src/components/ui/input.tsx");
/* harmony import */ var _components_ui_label__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @/components/ui/label */ "(ssr)/./src/components/ui/label.tsx");
/* harmony import */ var _components_ui_card__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @/components/ui/card */ "(ssr)/./src/components/ui/card.tsx");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! next/link */ "./node_modules/next/link.js");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(next_link__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _hooks_use_toast__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @/hooks/use-toast */ "(ssr)/./src/hooks/use-toast.ts");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__, _components_ui_button__WEBPACK_IMPORTED_MODULE_4__, _components_ui_input__WEBPACK_IMPORTED_MODULE_5__, _components_ui_label__WEBPACK_IMPORTED_MODULE_6__, _components_ui_card__WEBPACK_IMPORTED_MODULE_7__, _hooks_use_toast__WEBPACK_IMPORTED_MODULE_9__]);
([_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__, _components_ui_button__WEBPACK_IMPORTED_MODULE_4__, _components_ui_input__WEBPACK_IMPORTED_MODULE_5__, _components_ui_label__WEBPACK_IMPORTED_MODULE_6__, _components_ui_card__WEBPACK_IMPORTED_MODULE_7__, _hooks_use_toast__WEBPACK_IMPORTED_MODULE_9__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/* __next_internal_client_entry_do_not_use__ default auto */ 










function LoginPage() {
    const [email, setEmail] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)("");
    const [password, setPassword] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)("");
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const { login } = (0,_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__.useAuth)();
    const router = (0,next_navigation__WEBPACK_IMPORTED_MODULE_3__.useRouter)();
    const { toast } = (0,_hooks_use_toast__WEBPACK_IMPORTED_MODULE_9__.useToast)();
    // Check for success message from signup
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(()=>{
        const params = new URLSearchParams(window.location.search);
        if (params.get("signup") === "success") {
            toast({
                title: "Registro Exitoso",
                description: "Ahora puedes iniciar sesi\xf3n con tus credenciales.",
                variant: "default"
            });
            // Clean the query param
            router.replace("/login");
        }
    }, [
        router,
        toast
    ]);
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setError(null);
        setLoading(true);
        const { error: loginError } = await login({
            email,
            password
        });
        setLoading(false);
        if (loginError) {
            setError(loginError.message);
        } else {
            router.push("/"); // Redirigir a la p\xe1gina principal despu\xe9s del login
        }
    };
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
        className: "flex items-center justify-center min-h-screen bg-background",
        children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.Card, {
            className: "w-full max-w-md shadow-xl",
            children: [
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.CardHeader, {
                    children: [
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.CardTitle, {
                            className: "text-2xl font-bold text-center",
                            children: "Iniciar Sesi\xf3n"
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.CardDescription, {
                            className: "text-center",
                            children: "Ingresa tus credenciales para acceder a Turnos de Vuelo."
                        })
                    ]
                }),
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.CardContent, {
                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("form", {
                        onSubmit: handleSubmit,
                        className: "space-y-6",
                        children: [
                            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_label__WEBPACK_IMPORTED_MODULE_6__.Label, {
                                        htmlFor: "email",
                                        children: "Correo Electr\xf3nico"
                                    }),
                                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_5__.Input, {
                                        id: "email",
                                        type: "email",
                                        placeholder: "tu@email.com",
                                        value: email,
                                        onChange: (e)=>setEmail(e.target.value),
                                        required: true,
                                        disabled: loading
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_label__WEBPACK_IMPORTED_MODULE_6__.Label, {
                                        htmlFor: "password",
                                        children: "Contrase\xf1a"
                                    }),
                                    /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_5__.Input, {
                                        id: "password",
                                        type: "password",
                                        placeholder: "********",
                                        value: password,
                                        onChange: (e)=>setPassword(e.target.value),
                                        required: true,
                                        disabled: loading
                                    })
                                ]
                            }),
                            error && /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", {
                                className: "text-sm text-destructive text-center",
                                children: error
                            }),
                            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_button__WEBPACK_IMPORTED_MODULE_4__.Button, {
                                type: "submit",
                                className: "w-full",
                                disabled: loading,
                                children: loading ? "Ingresando..." : "Ingresar"
                            })
                        ]
                    })
                }),
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_7__.CardFooter, {
                    className: "flex flex-col items-center text-sm",
                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("p", {
                        className: "mt-2",
                        children: [
                            "\xbfNo tienes cuenta?",
                            " ",
                            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)((next_link__WEBPACK_IMPORTED_MODULE_8___default()), {
                                href: "/signup",
                                className: "text-primary hover:underline",
                                children: "Reg\xedstrate"
                            })
                        ]
                    })
                })
            ]
        })
    });
}


/***/ }),

/***/ "(ssr)/./src/contexts/AuthContext.tsx":
/*!********************************************!*\
  !*** (ssr)/./src/contexts/AuthContext.tsx ***!
  \********************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AuthContext: () => (/* binding */ AuthContext),
/* harmony export */   AuthProvider: () => (/* binding */ AuthProvider),
/* harmony export */   useAuth: () => (/* binding */ useAuth)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "(ssr)/./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "(ssr)/./node_modules/react/index.js");
/* harmony import */ var _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/supabaseClient */ "(ssr)/./src/lib/supabaseClient.tsx");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__]);
_lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];



const AuthContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);
const AuthProvider = ({ children })=>{
    const [user, setUser] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [session, setSession] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(true); // Manages initial loading state
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(()=>{
        const getInitialSession = async ()=>{
            const { data: { session: currentSession }, error } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.getSession();
            if (error) {
                // console.error("Error al obtener la sesi\xf3n inicial:", error); // Removed for consistency
                if (loading) setLoading(false);
                return;
            }
            setSession(currentSession);
            setUser(currentSession?.user ? {
                id: currentSession.user.id,
                email: currentSession.user.email
            } : null);
        };
        getInitialSession();
        const { data: { subscription } } = _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.onAuthStateChange((event, currentSession)=>{
            setSession(currentSession);
            setUser(currentSession?.user ? {
                id: currentSession.user.id,
                email: currentSession.user.email
            } : null);
            if (event === "INITIAL_SESSION") {
                setLoading(false);
            } else if (event === "SIGNED_IN" && loading) {
                setLoading(false);
            } else if (event === "SIGNED_OUT" && loading) {
                setLoading(false);
            } else if (!currentSession && loading && event !== "USER_UPDATED" && event !== "PASSWORD_RECOVERY" && event !== "TOKEN_REFRESHED" && event !== "MFA_CHALLENGE_VERIFIED") {
                setLoading(false);
            }
        });
        return ()=>{
            subscription?.unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const login = async (credentials)=>{
        const { error } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.signInWithPassword(credentials);
        if (error) {
        // The onAuthStateChange listener will handle session updates and loading state.
        // No need for fallback setLoading(false) here as it might conflict.
        }
        return {
            error
        };
    };
    const logout = async ()=>{
        const { error } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.signOut();
        if (error) {}
        // setUser(null) and setSession(null) will be triggered by onAuthStateChange
        return {
            error
        };
    };
    const signUp = async (credentials)=>{
        const { data, error } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.signUp(credentials);
        if (error) {}
        return {
            data: {
                user: data.user,
                session: data.session
            },
            error
        };
    };
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(AuthContext.Provider, {
        value: {
            user,
            session,
            loading,
            login,
            logout,
            signUp
        },
        children: children
    });
};
const useAuth = ()=>{
    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider");
    }
    return context;
};


/***/ }),

/***/ "(ssr)/./src/hooks/use-toast.ts":
/*!**************************************!*\
  !*** (ssr)/./src/hooks/use-toast.ts ***!
  \**************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   reducer: () => (/* binding */ reducer),
/* harmony export */   toast: () => (/* binding */ toast),
/* harmony export */   useToast: () => (/* binding */ useToast)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "(ssr)/./node_modules/react/index.js");
/* __next_internal_client_entry_do_not_use__ reducer,toast,useToast auto */ 
// Inspired by react-hot-toast library

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;
const actionTypes = {
    ADD_TOAST: "ADD_TOAST",
    UPDATE_TOAST: "UPDATE_TOAST",
    DISMISS_TOAST: "DISMISS_TOAST",
    REMOVE_TOAST: "REMOVE_TOAST"
};
let count = 0;
function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER;
    return count.toString();
}
const toastTimeouts = new Map();
const addToRemoveQueue = (toastId)=>{
    if (toastTimeouts.has(toastId)) {
        return;
    }
    const timeout = setTimeout(()=>{
        toastTimeouts.delete(toastId);
        dispatch({
            type: "REMOVE_TOAST",
            toastId: toastId
        });
    }, TOAST_REMOVE_DELAY);
    toastTimeouts.set(toastId, timeout);
};
const reducer = (state, action)=>{
    switch(action.type){
        case "ADD_TOAST":
            return {
                ...state,
                toasts: [
                    action.toast,
                    ...state.toasts
                ].slice(0, TOAST_LIMIT)
            };
        case "UPDATE_TOAST":
            return {
                ...state,
                toasts: state.toasts.map((t)=>t.id === action.toast.id ? {
                        ...t,
                        ...action.toast
                    } : t)
            };
        case "DISMISS_TOAST":
            {
                const { toastId } = action;
                // ! Side effects ! - This could be extracted into a dismissToast() action,
                // but I'll keep it here for simplicity
                if (toastId) {
                    addToRemoveQueue(toastId);
                } else {
                    state.toasts.forEach((toast)=>{
                        addToRemoveQueue(toast.id);
                    });
                }
                return {
                    ...state,
                    toasts: state.toasts.map((t)=>t.id === toastId || toastId === undefined ? {
                            ...t,
                            open: false
                        } : t)
                };
            }
        case "REMOVE_TOAST":
            if (action.toastId === undefined) {
                return {
                    ...state,
                    toasts: []
                };
            }
            return {
                ...state,
                toasts: state.toasts.filter((t)=>t.id !== action.toastId)
            };
    }
};
const listeners = [];
let memoryState = {
    toasts: []
};
function dispatch(action) {
    memoryState = reducer(memoryState, action);
    listeners.forEach((listener)=>{
        listener(memoryState);
    });
}
function toast({ ...props }) {
    const id = genId();
    const update = (props)=>dispatch({
            type: "UPDATE_TOAST",
            toast: {
                ...props,
                id
            }
        });
    const dismiss = ()=>dispatch({
            type: "DISMISS_TOAST",
            toastId: id
        });
    dispatch({
        type: "ADD_TOAST",
        toast: {
            ...props,
            id,
            open: true,
            onOpenChange: (open)=>{
                if (!open) dismiss();
            }
        }
    });
    return {
        id: id,
        dismiss,
        update
    };
}
function useToast() {
    const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(memoryState);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{
        listeners.push(setState);
        return ()=>{
            const index = listeners.indexOf(setState);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, [
        state
    ]);
    return {
        ...state,
        toast,
        dismiss: (toastId)=>dispatch({
                type: "DISMISS_TOAST",
                toastId
            })
    };
}


/***/ }),

/***/ "(ssr)/./src/lib/supabaseClient.tsx":
/*!******************************************!*\
  !*** (ssr)/./src/lib/supabaseClient.tsx ***!
  \******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   supabase: () => (/* binding */ supabase)
/* harmony export */ });
/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ "(ssr)/./node_modules/@supabase/supabase-js/dist/module/index.js");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__]);
_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || supabaseUrl.trim() === "") {
    throw new Error("Supabase URL is missing or empty. Ensure NEXT_PUBLIC_SUPABASE_URL is set correctly in your .env.local file and that the Next.js server has been restarted.");
}
if (!supabaseAnonKey || supabaseAnonKey.trim() === "") {
    throw new Error("Supabase anon key is missing or empty. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly in your .env.local file and that the Next.js server has been restarted.");
}
try {
    // Validate if the supabaseUrl is a valid URL format
    new URL(supabaseUrl);
} catch (e) {
    throw new Error(`The Supabase URL provided ("${supabaseUrl}") is not a valid URL. Please check the value of NEXT_PUBLIC_SUPABASE_URL in your .env.local file.`);
}
// Basic check for anon key format (Supabase anon keys are JWTs, typically starting with "eyJ")
if (!supabaseAnonKey.startsWith("eyJ")) {
    console.warn(`Warning: The Supabase anon key provided does not look like a standard JWT (expected to start with "eyJ..."). Please double-check NEXT_PUBLIC_SUPABASE_ANON_KEY.`);
}
const supabase = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(supabaseUrl, supabaseAnonKey);


/***/ }),

/***/ "(ssr)/./src/store/data-hooks.ts":
/*!***************************************!*\
  !*** (ssr)/./src/store/data-hooks.ts ***!
  \***************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   useAircraftStore: () => (/* binding */ useAircraftStore),
/* harmony export */   useDailyObservationsStore: () => (/* binding */ useDailyObservationsStore),
/* harmony export */   usePilotCategoriesStore: () => (/* binding */ usePilotCategoriesStore),
/* harmony export */   usePilotsStore: () => (/* binding */ usePilotsStore),
/* harmony export */   useScheduleStore: () => (/* binding */ useScheduleStore)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "(ssr)/./node_modules/react/index.js");
/* harmony import */ var _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/supabaseClient */ "(ssr)/./src/lib/supabaseClient.tsx");
/* harmony import */ var date_fns__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! date-fns */ "(ssr)/./node_modules/date-fns/index.js");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__]);
_lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];



// Helper function for more detailed error logging
function logSupabaseError(context, error) {
    console.error(`${context}. Full error object:`, error);
    if (error && typeof error === "object") {
        if (error.code === "PGRST116") {
            console.warn("Hint: Error PGRST116 (JSON object requested, multiple (or no) rows returned) occurred. This often happens if RLS policies prevent selecting the record after an INSERT/UPDATE, or if the record ID for an update/delete didn't exist.");
        }
        if ("message" in error) console.error("Supabase error message:", error.message);
        if ("details" in error) console.error("Supabase error details:", error.details);
        if ("hint" in error) console.error("Supabase error hint:", error.hint);
        if ("code" in error) console.error("Supabase error code:", error.code);
    }
}
// Pilots Store
function usePilotsStore() {
    const [pilots, setPilots] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const fetchingRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
    const fetchPilots = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async ()=>{
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilots").select("*").order("last_name").order("first_name");
            if (fetchError) {
                logSupabaseError("Error fetching pilots", fetchError);
                setError(fetchError);
            } else {
                setPilots(data || []);
            }
        } catch (e) {
            logSupabaseError("Unexpected error in fetchPilots", e);
            setError(e);
        } finally{
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{
        fetchPilots();
    }, [
        fetchPilots
    ]);
    const addPilot = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (pilotData)=>{
        setError(null);
        // RLS should protect who can set auth_user_id and is_admin
        // For now, we assume the UI passes these if needed and RLS validates.
        console.warn("SECURITY/FUNCTIONALITY NOTE: `addPilot` called. Ensure RLS policies correctly restrict who can set `auth_user_id` if provided. The 'is_admin' field is no longer part of the Pilot type for UI operations as per previous requests.");
        const { data: newPilot, error: insertError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilots").insert([
            pilotData
        ]).select().single();
        if (insertError) {
            logSupabaseError("Error adding pilot", insertError);
            setError(insertError);
            return null;
        }
        if (newPilot) {
            await fetchPilots(); // Refetch to update list
        }
        return newPilot;
    }, [
        fetchPilots
    ]);
    const updatePilot = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (updatedPilotData)=>{
        setError(null);
        const { id, created_at, ...updatePayload } = updatedPilotData;
        console.warn("SECURITY NOTE: `updatePilot` called. Ensure RLS policies correctly restrict who can update pilot data and which fields (e.g., 'medical_expiry'). The 'is_admin' field is no longer part of the Pilot type for UI operations.");
        console.log("Attempting to update pilot with ID:", id, "Payload:", updatePayload);
        const { data: updatedPilot, error: updateError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilots").update(updatePayload).eq("id", id).select().single();
        if (updateError) {
            logSupabaseError("Error updating pilot", updateError);
            setError(updateError);
            return null;
        }
        if (updatedPilot) {
            await fetchPilots(); // Refetch to update list
        }
        return updatedPilot;
    }, [
        fetchPilots
    ]);
    const deletePilot = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (pilotId)=>{
        setError(null);
        const { error: deleteError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilots").delete().eq("id", pilotId);
        if (deleteError) {
            logSupabaseError("Error deleting pilot", deleteError);
            setError(deleteError);
            return false;
        }
        await fetchPilots(); // Refetch to update list
        return true;
    }, [
        fetchPilots
    ]);
    const getPilotName = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((pilotId)=>{
        const pilot = pilots.find((p)=>p.id === pilotId);
        return pilot ? `${pilot.first_name} ${pilot.last_name}` : "Piloto Desconocido";
    }, [
        pilots
    ]);
    return {
        pilots,
        loading,
        error,
        addPilot,
        updatePilot,
        deletePilot,
        getPilotName,
        fetchPilots
    };
}
// Pilot Categories Store
function usePilotCategoriesStore() {
    const [categories, setCategories] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const fetchingRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
    const DEFAULT_CATEGORIES = [
        {
            id: "static-cat-instructor",
            name: "Instructor",
            created_at: new Date().toISOString()
        },
        {
            id: "static-cat-tow-pilot",
            name: "Remolcador",
            created_at: new Date().toISOString()
        },
        {
            id: "static-cat-glider-pilot",
            name: "Piloto planeador",
            created_at: new Date().toISOString()
        }
    ];
    const fetchCategories = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async ()=>{
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilot_categories").select("*").order("name");
            if (fetchError) {
                logSupabaseError("Error fetching pilot categories", fetchError);
                setError(fetchError);
                setCategories(DEFAULT_CATEGORIES);
            } else {
                setCategories(data && data.length > 0 ? data : DEFAULT_CATEGORIES);
            }
        } catch (e) {
            logSupabaseError("Unexpected error in fetchCategories", e);
            setError(e);
            setCategories(DEFAULT_CATEGORIES);
        } finally{
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [
        DEFAULT_CATEGORIES
    ]);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{
        fetchCategories();
    }, [
        fetchCategories
    ]);
    const addCategory = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (categoryData)=>{
        setError(null);
        const { data: newCategory, error: insertError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilot_categories").insert([
            categoryData
        ]).select().single();
        if (insertError) {
            logSupabaseError("Error adding pilot category", insertError);
            setError(insertError);
            return null;
        }
        if (newCategory) {
            await fetchCategories();
        }
        return newCategory;
    }, [
        fetchCategories
    ]);
    const updateCategory = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (updatedCategoryData)=>{
        setError(null);
        const { id, created_at, ...updatePayload } = updatedCategoryData;
        const { data: updatedCategory, error: updateError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilot_categories").update(updatePayload).eq("id", id).select().single();
        if (updateError) {
            logSupabaseError("Error updating pilot category", updateError);
            setError(updateError);
            return null;
        }
        if (updatedCategory) {
            await fetchCategories();
        }
        return updatedCategory;
    }, [
        fetchCategories
    ]);
    const deleteCategory = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (categoryId)=>{
        setError(null);
        const { error: deleteError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("pilot_categories").delete().eq("id", categoryId);
        if (deleteError) {
            logSupabaseError("Error deleting pilot category", deleteError);
            setError(deleteError);
            return false;
        }
        await fetchCategories();
        return true;
    }, [
        fetchCategories
    ]);
    const getCategoryName = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((categoryId)=>{
        const category = categories.find((c)=>c.id === categoryId);
        return category ? category.name : "Categor\xeda Desconocida";
    }, [
        categories
    ]);
    return {
        categories,
        loading,
        error,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryName,
        fetchCategories
    };
}
// Aircraft Store
function useAircraftStore() {
    const [aircraft, setAircraft] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const fetchingRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
    const fetchAircraft = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async ()=>{
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("aircraft").select("*").order("name");
            if (fetchError) {
                logSupabaseError("Error fetching aircraft", fetchError);
                setError(fetchError);
            } else {
                setAircraft(data || []);
            }
        } catch (e) {
            logSupabaseError("Unexpected error in fetchAircraft", e);
            setError(e);
        } finally{
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);
    (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(()=>{
        fetchAircraft();
    }, [
        fetchAircraft
    ]);
    const addAircraft = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (aircraftData)=>{
        setError(null);
        const { data: newAircraft, error: insertError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("aircraft").insert([
            aircraftData
        ]).select().single();
        if (insertError) {
            logSupabaseError("Error adding aircraft", insertError);
            setError(insertError);
            return null;
        }
        if (newAircraft) {
            await fetchAircraft();
        }
        return newAircraft;
    }, [
        fetchAircraft
    ]);
    const updateAircraft = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (updatedAircraftData)=>{
        setError(null);
        const { id, created_at, ...updatePayload } = updatedAircraftData;
        const { data: updatedAircraft, error: updateError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("aircraft").update(updatePayload).eq("id", id).select().single();
        if (updateError) {
            logSupabaseError("Error updating aircraft", updateError);
            setError(updateError);
            return null;
        }
        if (updatedAircraft) {
            await fetchAircraft();
        }
        return updatedAircraft;
    }, [
        fetchAircraft
    ]);
    const deleteAircraft = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (aircraftId)=>{
        setError(null);
        const { error: deleteError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("aircraft").delete().eq("id", aircraftId);
        if (deleteError) {
            logSupabaseError("Error deleting aircraft", deleteError);
            setError(deleteError);
            return false;
        }
        await fetchAircraft();
        return true;
    }, [
        fetchAircraft
    ]);
    const getAircraftName = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((aircraftId)=>{
        if (!aircraftId) return "N/A";
        const ac = aircraft.find((a)=>a.id === aircraftId);
        return ac ? ac.name : "Aeronave Desconocida";
    }, [
        aircraft
    ]);
    return {
        aircraft,
        loading,
        error,
        addAircraft,
        updateAircraft,
        deleteAircraft,
        getAircraftName,
        fetchAircraft
    };
}
// Schedule Store
function useScheduleStore() {
    const [scheduleEntries, setScheduleEntries] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const fetchingRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
    const fetchScheduleEntries = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (date)=>{
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            let query = _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").select("*");
            if (date) {
                query = query.eq("date", date);
            }
            // The sorting logic is now primarily handled in ScheduleClient's useMemo
            // query = query.order('date').order('start_time'); 
            const { data, error: fetchError } = await query;
            if (fetchError) {
                logSupabaseError("Error fetching schedule entries", fetchError);
                setError(fetchError);
            } else {
                setScheduleEntries(data || []);
            }
        } catch (e) {
            logSupabaseError("Unexpected error in fetchScheduleEntries", e);
            setError(e);
        } finally{
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);
    const fetchScheduleEntriesForRange = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (startDateStr, endDateStr)=>{
        try {
            const { data, error: fetchError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").select("*").gte("date", startDateStr).lte("date", endDateStr).order("date").order("start_time");
            if (fetchError) {
                logSupabaseError("Error fetching schedule entries for range", fetchError);
                return null;
            }
            return data || [];
        } catch (e) {
            logSupabaseError("Unexpected error in fetchScheduleEntriesForRange", e);
            return null;
        }
    }, []);
    const addScheduleEntry = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (entryData)=>{
        setError(null);
        const { data: newEntry, error: insertError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").insert([
            entryData
        ]).select().single();
        if (insertError) {
            logSupabaseError("Error adding schedule entry", insertError);
            setError(insertError);
            return null;
        }
        if (newEntry) {
            await fetchScheduleEntries(newEntry.date);
        }
        return newEntry;
    }, [
        fetchScheduleEntries
    ]);
    const updateScheduleEntry = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (updatedEntryData)=>{
        setError(null);
        const { created_at, id, ...updatePayload } = updatedEntryData;
        const { data: updatedEntry, error: updateError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").update(updatePayload).eq("id", id).select().single();
        if (updateError) {
            logSupabaseError("Error updating schedule entry", updateError);
            setError(updateError);
            return null;
        }
        if (updatedEntry) {
            await fetchScheduleEntries(updatedEntry.date);
        }
        return updatedEntry;
    }, [
        fetchScheduleEntries
    ]);
    const deleteScheduleEntry = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (entryId, entryDate)=>{
        setError(null);
        const { error: deleteError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").delete().eq("id", entryId);
        if (deleteError) {
            logSupabaseError("Error deleting schedule entry", deleteError);
            setError(deleteError);
            return false;
        }
        await fetchScheduleEntries(entryDate);
        return true;
    }, [
        fetchScheduleEntries
    ]);
    const cleanupOldScheduleEntries = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async ()=>{
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thresholdDate = (0,date_fns__WEBPACK_IMPORTED_MODULE_2__.format)(thirtyDaysAgo, "yyyy-MM-dd");
            const { error: deleteError, count } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("schedule_entries").delete({
                count: "exact"
            }).lt("date", thresholdDate);
            if (deleteError) {
                logSupabaseError("Error cleaning up old schedule entries", deleteError);
                return {
                    success: false,
                    error: deleteError,
                    count: 0
                };
            }
            return {
                success: true,
                count: count ?? 0
            };
        } catch (e) {
            logSupabaseError("Unexpected error during old schedule entry cleanup", e);
            return {
                success: false,
                error: e,
                count: 0
            };
        }
    }, []);
    return {
        scheduleEntries,
        loading,
        error,
        addScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry,
        fetchScheduleEntries,
        cleanupOldScheduleEntries,
        fetchScheduleEntriesForRange
    };
}
function useDailyObservationsStore() {
    const [dailyObservations, setDailyObservations] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)({});
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
    const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
    const fetchingRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(false);
    const fetchObservations = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (date)=>{
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            let query = _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("daily_observations").select("*");
            if (date) {
                query = query.eq("date", date);
            }
            const { data, error: fetchError } = await query;
            if (fetchError) {
                logSupabaseError("Error fetching daily observations", fetchError);
                setError(fetchError);
            } else {
                const newObservationsMap = {};
                (data || []).forEach((obs)=>{
                    newObservationsMap[obs.date] = obs;
                });
                setDailyObservations((prev)=>date ? {
                        ...prev,
                        ...newObservationsMap
                    } : newObservationsMap);
            }
        } catch (e) {
            logSupabaseError("Unexpected error in fetchObservations", e);
            setError(e);
        } finally{
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);
    const fetchObservationsForRange = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (startDateStr, endDateStr)=>{
        try {
            const { data, error: fetchError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("daily_observations").select("*").gte("date", startDateStr).lte("date", endDateStr).order("date");
            if (fetchError) {
                logSupabaseError("Error fetching daily observations for range", fetchError);
                return null;
            }
            return data || [];
        } catch (e) {
            logSupabaseError("Unexpected error in fetchObservationsForRange", e);
            return null;
        }
    }, []);
    const getObservation = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((date)=>{
        return dailyObservations[date]?.observation_text || undefined;
    }, [
        dailyObservations
    ]);
    const updateObservation = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (date, text)=>{
        setError(null);
        const { data: upsertedObservation, error: upsertError } = await _lib_supabaseClient__WEBPACK_IMPORTED_MODULE_1__.supabase.from("daily_observations").upsert({
            date: date,
            observation_text: text,
            updated_at: new Date().toISOString()
        }, {
            onConflict: "date"
        }).select().single();
        if (upsertError) {
            logSupabaseError("Error updating daily observation", upsertError);
            setError(upsertError);
            return null;
        }
        if (upsertedObservation) {
            setDailyObservations((prev)=>({
                    ...prev,
                    [date]: upsertedObservation
                }));
        }
        return upsertedObservation;
    }, []);
    return {
        dailyObservations,
        loading,
        error,
        getObservation,
        updateObservation,
        fetchObservations,
        fetchObservationsForRange
    };
}


/***/ }),

/***/ "(ssr)/./src/types/index.ts":
/*!**********************************!*\
  !*** (ssr)/./src/types/index.ts ***!
  \**********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FLIGHT_TYPES: () => (/* binding */ FLIGHT_TYPES)
/* harmony export */ });
const FLIGHT_TYPES = [
    {
        id: "instruction",
        name: "Instrucci\xf3n"
    },
    {
        id: "local",
        name: "Local"
    },
    {
        id: "sport",
        name: "Deportivo"
    },
    {
        id: "towage",
        name: "Remolque"
    }
]; // Type for daily observations, matching the Supabase table structure.


/***/ }),

/***/ "(ssr)/./src/app/signup/page.tsx":
/*!***************************************!*\
  !*** (ssr)/./src/app/signup/page.tsx ***!
  \***************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SignupPage)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "(ssr)/./node_modules/react/jsx-runtime.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "(ssr)/./node_modules/react/index.js");
/* harmony import */ var _contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/contexts/AuthContext */ "(ssr)/./src/contexts/AuthContext.tsx");
/* harmony import */ var _store_data_hooks__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/store/data-hooks */ "(ssr)/./src/store/data-hooks.ts");
/* harmony import */ var next_navigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! next/navigation */ "(ssr)/./node_modules/next/dist/client/components/navigation.js");
/* harmony import */ var _hookform_resolvers_zod__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @hookform/resolvers/zod */ "(ssr)/./node_modules/@hookform/resolvers/zod/dist/zod.mjs");
/* harmony import */ var react_hook_form__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-hook-form */ "(ssr)/./node_modules/react-hook-form/dist/index.esm.mjs");
/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! zod */ "(ssr)/./node_modules/zod/lib/index.mjs");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @/components/ui/button */ "(ssr)/./src/components/ui/button.tsx");
/* harmony import */ var _components_ui_form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @/components/ui/form */ "(ssr)/./src/components/ui/form.tsx");
/* harmony import */ var _components_ui_input__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @/components/ui/input */ "(ssr)/./src/components/ui/input.tsx");
/* harmony import */ var _components_ui_card__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @/components/ui/card */ "(ssr)/./src/components/ui/card.tsx");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! next/link */ "./node_modules/next/link.js");
/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(next_link__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var _hooks_use_toast__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @/hooks/use-toast */ "(ssr)/./src/hooks/use-toast.ts");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__, _store_data_hooks__WEBPACK_IMPORTED_MODULE_3__, _hookform_resolvers_zod__WEBPACK_IMPORTED_MODULE_5__, react_hook_form__WEBPACK_IMPORTED_MODULE_6__, zod__WEBPACK_IMPORTED_MODULE_7__, _components_ui_button__WEBPACK_IMPORTED_MODULE_8__, _components_ui_form__WEBPACK_IMPORTED_MODULE_9__, _components_ui_input__WEBPACK_IMPORTED_MODULE_10__, _components_ui_card__WEBPACK_IMPORTED_MODULE_11__, _hooks_use_toast__WEBPACK_IMPORTED_MODULE_13__]);
([_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__, _store_data_hooks__WEBPACK_IMPORTED_MODULE_3__, _hookform_resolvers_zod__WEBPACK_IMPORTED_MODULE_5__, react_hook_form__WEBPACK_IMPORTED_MODULE_6__, zod__WEBPACK_IMPORTED_MODULE_7__, _components_ui_button__WEBPACK_IMPORTED_MODULE_8__, _components_ui_form__WEBPACK_IMPORTED_MODULE_9__, _components_ui_input__WEBPACK_IMPORTED_MODULE_10__, _components_ui_card__WEBPACK_IMPORTED_MODULE_11__, _hooks_use_toast__WEBPACK_IMPORTED_MODULE_13__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/* __next_internal_client_entry_do_not_use__ default auto */ 













// Esquema de validaci\xf3n con Zod
const signupSchema = zod__WEBPACK_IMPORTED_MODULE_7__.z.object({
    first_name: zod__WEBPACK_IMPORTED_MODULE_7__.z.string().min(1, "El nombre es obligatorio."),
    last_name: zod__WEBPACK_IMPORTED_MODULE_7__.z.string().min(1, "El apellido es obligatorio."),
    email: zod__WEBPACK_IMPORTED_MODULE_7__.z.string().email("Correo electr\xf3nico inv\xe1lido."),
    password: zod__WEBPACK_IMPORTED_MODULE_7__.z.string().min(6, "La contrase\xf1a debe tener al menos 6 caracteres."),
    confirmPassword: zod__WEBPACK_IMPORTED_MODULE_7__.z.string().min(6, "La confirmaci\xf3n de contrase\xf1a debe tener al menos 6 caracteres.")
}).refine((data)=>data.password === data.confirmPassword, {
    message: "Las contrase\xf1as no coinciden.",
    path: [
        "confirmPassword"
    ]
});
function SignupPage() {
    const { signUp } = (0,_contexts_AuthContext__WEBPACK_IMPORTED_MODULE_2__.useAuth)();
    const { addPilot } = (0,_store_data_hooks__WEBPACK_IMPORTED_MODULE_3__.usePilotsStore)();
    const router = (0,next_navigation__WEBPACK_IMPORTED_MODULE_4__.useRouter)();
    const { toast } = (0,_hooks_use_toast__WEBPACK_IMPORTED_MODULE_13__.useToast)();
    const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
    const [serverError, setServerError] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
    const form = (0,react_hook_form__WEBPACK_IMPORTED_MODULE_6__.useForm)({
        resolver: (0,_hookform_resolvers_zod__WEBPACK_IMPORTED_MODULE_5__.zodResolver)(signupSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            password: "",
            confirmPassword: ""
        }
    });
    const onSubmit = async (formData)=>{
        setLoading(true);
        setServerError(null);
        const { data: authData, error: authError } = await signUp({
            email: formData.email,
            password: formData.password
        });
        if (authError || !authData.user) {
            setServerError(authError?.message || "Error al crear el usuario en Supabase Auth.");
            setLoading(false);
            return;
        }
        // Usuario creado en Supabase Auth, ahora crear perfil de piloto
        const newPilotData = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            auth_user_id: authData.user.id,
            category_ids: [],
            medical_expiry: "2099-01-01" // Placeholder, el usuario/admin deber\xe1 actualizar esto
        };
        const pilotProfile = await addPilot(newPilotData);
        if (!pilotProfile) {
            // Idealmente, aqu\xed deber\xedas manejar la eliminaci\xf3n del usuario de Supabase Auth
            // si la creaci\xf3n del perfil del piloto falla, para evitar usuarios hu\xe9rfanos.
            // Esto es m\xe1s complejo y requiere una funci\xf3n de admin en Supabase o una Edge Function.
            setServerError("Usuario de autenticaci\xf3n creado, pero fall\xf3 la creaci\xf3n del perfil de piloto. Contacta al administrador.");
            setLoading(false);
            return;
        }
        setLoading(false);
        toast({
            title: "Registro Exitoso",
            description: "Tu cuenta ha sido creada. Ahora puedes iniciar sesi\xf3n.",
            variant: "default"
        });
        router.push("/login?signup=success");
    };
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div", {
        className: "flex items-center justify-center min-h-screen bg-background py-12",
        children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.Card, {
            className: "w-full max-w-lg shadow-xl",
            children: [
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.CardHeader, {
                    children: [
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.CardTitle, {
                            className: "text-2xl font-bold text-center",
                            children: "Crear Cuenta de Piloto"
                        }),
                        /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.CardDescription, {
                            className: "text-center",
                            children: "Completa tus datos para registrarte en Turnos de Vuelo."
                        })
                    ]
                }),
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.CardContent, {
                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.Form, {
                        ...form,
                        children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("form", {
                            onSubmit: form.handleSubmit(onSubmit),
                            className: "space-y-6",
                            children: [
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormField, {
                                    control: form.control,
                                    name: "first_name",
                                    render: ({ field })=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormItem, {
                                            children: [
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormLabel, {
                                                    children: "Nombre"
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormControl, {
                                                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_10__.Input, {
                                                        placeholder: "Juan",
                                                        ...field
                                                    })
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormMessage, {})
                                            ]
                                        })
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormField, {
                                    control: form.control,
                                    name: "last_name",
                                    render: ({ field })=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormItem, {
                                            children: [
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormLabel, {
                                                    children: "Apellido"
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormControl, {
                                                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_10__.Input, {
                                                        placeholder: "P\xe9rez",
                                                        ...field
                                                    })
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormMessage, {})
                                            ]
                                        })
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormField, {
                                    control: form.control,
                                    name: "email",
                                    render: ({ field })=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormItem, {
                                            children: [
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormLabel, {
                                                    children: "Correo Electr\xf3nico"
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormControl, {
                                                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_10__.Input, {
                                                        type: "email",
                                                        placeholder: "juan.perez@email.com",
                                                        ...field
                                                    })
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormMessage, {})
                                            ]
                                        })
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormField, {
                                    control: form.control,
                                    name: "password",
                                    render: ({ field })=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormItem, {
                                            children: [
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormLabel, {
                                                    children: "Contrase\xf1a"
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormControl, {
                                                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_10__.Input, {
                                                        type: "password",
                                                        placeholder: "********",
                                                        ...field
                                                    })
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormMessage, {})
                                            ]
                                        })
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormField, {
                                    control: form.control,
                                    name: "confirmPassword",
                                    render: ({ field })=>/*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormItem, {
                                            children: [
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormLabel, {
                                                    children: "Confirmar Contrase\xf1a"
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormControl, {
                                                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_input__WEBPACK_IMPORTED_MODULE_10__.Input, {
                                                        type: "password",
                                                        placeholder: "********",
                                                        ...field
                                                    })
                                                }),
                                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_form__WEBPACK_IMPORTED_MODULE_9__.FormMessage, {})
                                            ]
                                        })
                                }),
                                serverError && /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("p", {
                                    className: "text-sm text-destructive text-center",
                                    children: serverError
                                }),
                                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_button__WEBPACK_IMPORTED_MODULE_8__.Button, {
                                    type: "submit",
                                    className: "w-full",
                                    disabled: loading,
                                    children: loading ? "Registrando..." : "Crear Cuenta"
                                })
                            ]
                        })
                    })
                }),
                /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_components_ui_card__WEBPACK_IMPORTED_MODULE_11__.CardFooter, {
                    className: "flex justify-center text-sm",
                    children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("p", {
                        children: [
                            "\xbfYa tienes una cuenta?",
                            " ",
                            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)((next_link__WEBPACK_IMPORTED_MODULE_12___default()), {
                                href: "/login",
                                className: "text-primary hover:underline",
                                children: "Inicia Sesi\xf3n"
                            })
                        ]
                    })
                })
            ]
        })
    });
}


/***/ }),

/***/ "(ssr)/./src/types/index.ts":
/*!**********************************!*\
  !*** (ssr)/./src/types/index.ts ***!
  \**********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FLIGHT_TYPES: () => (/* binding */ FLIGHT_TYPES)
/* harmony export */ });
const FLIGHT_TYPES = [
    {
        id: "instruction",
        name: "Instrucci\xf3n"
    },
    {
        id: "local",
        name: "Local"
    },
    {
        id: "sport",
        name: "Deportivo"
    },
    {
        id: "towage",
        name: "Remolque"
    }
]; // Type for daily observations, matching the Supabase table structure.


/***/ })

};
;
