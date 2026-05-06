/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  OPENROUTER_API_KEY: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
