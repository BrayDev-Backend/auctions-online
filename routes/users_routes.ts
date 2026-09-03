import express, { Router } from "express";
import { getUserProfile } from "../controllers/users_handlers";

const usersRouter: Router = express.Router();

usersRouter.get("/users/me", getUserProfile);

export default usersRouter;