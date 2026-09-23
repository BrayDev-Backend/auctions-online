import express, { Router } from "express";
import { loginUser, registerUser } from "../controllers/auth.controller";

const authRoutes: Router = express.Router();

authRoutes.post("/register", registerUser);
authRoutes.post("/login", loginUser);

export default authRoutes;