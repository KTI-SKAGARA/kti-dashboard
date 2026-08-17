"use server";

import { cookies } from "next/headers";
import {
  DEFAULT_ADMIN_PASSWORD,
  COOKIE_NAME,
  SESSION_SECRET,
  SESSION_MAX_AGE,
} from "@/lib/constants";

export async function loginAdmin(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!SESSION_SECRET) {
      return {
        success: false,
        error: "Konfigurasi session belum di-set (SESSION_SECRET). Hubungi admin.",
      };
    }

    const input = (password || "").trim();
    const envPass = (process.env.ADMIN_PASSWORD || "").trim();
    const defaultPass = DEFAULT_ADMIN_PASSWORD.trim();

    const isValid =
      input.toLowerCase() === envPass.toLowerCase() ||
      input.toLowerCase() === defaultPass.toLowerCase() ||
      input === envPass ||
      input === defaultPass;

    if (!input || !isValid) {
      return { success: false, error: "Password / PIN Admin salah!" };
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, SESSION_SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal login.",
    };
  }
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
      path: "/",
    });
    cookieStore.delete(COOKIE_NAME);
    return { success: true };
  } catch {
    return { success: true };
  }
}

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  return session?.value === SESSION_SECRET;
}
