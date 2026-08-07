import { z } from "zod";

export const emailSchema = z
  .string()
  .min(5, "Email must be at least 5 characters.")
  .max(254, "Email must be at most 254 characters.")
  .email("Please enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const phoneSchema = z
  .string()
  .min(10, "Phone must be at least 10 characters.")
  .max(15, "Phone must be at most 15 characters.")
  .regex(/^(\+63|0)?\d{10}$/, "Phone must be a valid Philippine number.");

export const fullNameSchema = z.string().min(1, "Name is required.").max(100, "Name must be at most 100 characters.");

export const addressSchema = z
  .string()
  .min(1, "Address is required.")
  .max(500, "Address must be at most 500 characters.");

export const businessNameSchema = z
  .string()
  .min(1, "Business name is required.")
  .max(200, "Business name must be at most 200 characters.");

export const contactNameSchema = z
  .string()
  .min(1, "Contact name is required.")
  .max(100, "Contact name must be at most 100 characters.");
