import express, { Router } from "express";
import { loginUser, registerUser } from "../controllers/auth_handlers";

const authRouter: Router = express.Router();

authRouter.post("/auth/register", registerUser);
authRouter.post("/auth/login", loginUser);

export default authRouter;