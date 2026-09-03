import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    
    console.error("Error capturado por middleware:", err);

    const statusCode = err.statusCode || 500;
    const errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";
    const message = err.message || "Ocurrió un error inesperado en el servidor.";

    res.status(statusCode).json({
        ok: false,
        error: {
            code: errorCode,
            messages: message
        }
    });
};