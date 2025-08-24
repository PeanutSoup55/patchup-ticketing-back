import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../firebase';
import { UserRole, User } from '../types';