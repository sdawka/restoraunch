/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface LocationContext {
  locationId: number
  role: 'admin' | 'manager'
}

declare namespace App {
  interface Locals extends Runtime {
    location: LocationContext | null
  }
}
