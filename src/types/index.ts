export enum UserRole {
    CUSTOMER = 'customer',
    EMPLOYEE = 'employee',
    ADMIN = 'admin'
  }
  
  export enum TicketStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed'
  }
  
  export enum TicketPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
  }
  
  export interface User {
    uid: string;
    email: string;
    displayName?: string;
    role: UserRole;
    department?: string; // For employees
    phoneNumber?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
  }
  
  export interface Ticket {
    id?: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: string;
    customerId: string;
    customerEmail: string;
    assignedTo?: string; // Employee/Admin UID
    assignedToEmail?: string;
    createdBy: string; // UID of creator
    createdAt: Date;
    updatedAt: Date;
    dueDate?: Date;
    resolvedAt?: Date;
    tags?: string[];
    attachments?: string[]; // URLs to uploaded files
    comments: TicketComment[];
  }
  
  export interface TicketComment {
    id: string;
    ticketId: string;
    authorId: string;
    authorEmail: string;
    authorRole: UserRole;
    content: string;
    createdAt: Date;
    isInternal: boolean; // Internal notes only visible to employees/admins
  }
  
  export interface CreateTicketRequest {
    title: string;
    description: string;
    priority: TicketPriority;
    category: string;
    dueDate?: Date;
    tags?: string[];
  }
  
  export interface UpdateTicketRequest {
    title?: string;
    description?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: string;
    assignedTo?: string;
    dueDate?: Date;
    tags?: string[];
  }
  
  export interface AuthRequest extends Request {
    user?: User;
  }