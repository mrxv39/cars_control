import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  buildFewShotMessages,
  buildSystemPrompt,
  buildUserTurn,
  callClaude,
  fallbackReply,
  formatVehicleLine,
  handleRequest,
  type LeadMessageRow,
  type VehicleRow,
} from "./handler.ts";
import { FEW_SHOTS } from "./few_shots.ts";
import { detectLanguage } from "./lang_detect.ts";
import {
  firstNameOnly,
  redactEmails,
  redactPhones,
  sanitizeForPrompt,
} from "./sanitize.ts";

function vehicle(partial: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: 1,
    name: "VOLKSWAGEN Polo Advance",
    anio: 2021,
    km: 45000,
    precio_venta: 13980,
    estado: "disponible",
    fuel: "gasolina",
    transmission: "manual",
    cv: "95",
    ...partial,
  };
}

// ── sanitize ────────────────────────────────────────────────────────────

Deno.test("sanitize: redactPhones redacts 9-digit numbers except Ricard's", () => {
  const input = "Llámame al 602311083 o al 646131565";
  const out = redactPhones(input);
  assertStringIncludes(out, "[TELEFONO]");
  assertStringIncludes(out, "646131565");
  assert(!out.includes("602311083"));
});

Deno.test("sanitize: redactEmails redacts emails", () => {
  const out = redactEmails("contacta con foo.bar+spam@domain.co.uk");
  assertStringIncludes(out, "[EMAIL]");
  assert(!out.includes("foo.bar+spam@domain.co.uk"));
});

Deno.test("sanitize: firstNameOnly keeps only first token", () => {
  assertEquals(firstNameOnly("Jose Luis Garcia"), "Jose");
  assertEquals(firstNameOnly("  marina  "), "marina");
  assertEquals(firstNameOnly(""), "");
});

Deno.test("sanitize: sanitizeForPrompt strips phone and email together", () => {
  const out = sanitizeForPrompt("Soy Juan, tel 600123456, email juan@x.com");
  assertStringIncludes(out, "[TELEFONO]");
  assertStringIncludes(out, "[EMAIL]");
});

// ── lang_detect ─────────────────────────────────────────────────────────

Deno.test("lang_detect: catalan markers → ca", () => {
  assertEquals(detectLanguage("Bona tarda, gràcies per la resposta"), "ca");
  assertEquals(detectLanguage("Teniu historial del vehicle? 1 sol propietari?"), "ca");
});

Deno.test("lang_detect: castilian default → es", () => {
  assertEquals(detectLanguage("Hola buenas, me interesa este vehículo"), "es");
  assertEquals(detectLanguage(""), "es");
  assertEquals(detectLanguage(null), "es");
});

// ── prompt builders ─────────────────────────────────────────────────────

Deno.test("formatVehicleLine: uses only non-null fields", () => {
  const line = formatVehicleLine(vehicle({ transmission: null, cv: null }));
  assertStringIncludes(line, "VOLKSWAGEN Polo Advance");
  assertStringIncludes(line, "2021");
  assertStringIncludes(line, "45000 km");
  assertStringIncludes(line, "13980€");
});

Deno.test("buildSystemPrompt: includes language and core rules", () => {
  const sysEs = buildSystemPrompt("es");
  assertStringIncludes(sysEs, "castellano");
  assertStringIncludes(sysEs, "646131565");
  assertStringIncludes(sysEs, "<<lead_message>>");
  const sysCa = buildSystemPrompt("ca");
  assertStringIncludes(sysCa, "catalán");
});

Deno.test("buildFewShotMessages: emits 2 msgs per few-shot (user+assistant)", () => {
  const msgs = buildFewShotMessages();
  assertEquals(msgs.length, FEW_SHOTS.length * 2);
  for (let i = 0; i < msgs.length; i += 2) {
    assertEquals(msgs[i].role, "user");
    assertEquals(msgs[i + 1].role, "assistant");
  }
});

Deno.test("buildUserTurn: includes alternatives when vehicle reservado", () => {
  const veh = vehicle({ estado: "reservado" });
  const alts = [vehicle({ id: 2, name: "VOLKSWAGEN Polo GT", precio_venta: 14500 })];
  const turn = buildUserTurn(veh, alts, [], "Jose", "es");
  assertStringIncludes(turn, "ALTERNATIVAS");
  assertStringIncludes(turn, "Polo GT");
});

Deno.test("buildUserTurn: omits alternatives when vehicle disponible", () => {
  const veh = vehicle();
  const turn = buildUserTurn(veh, [], [], "Jose", "es");
  assert(!turn.includes("ALTERNATIVAS"));
});

Deno.test("buildUserTurn: sanitizes conversation content (no phones/emails leaked)", () => {
  const msgs: LeadMessageRow[] = [
    {
      sender: "lead",
      sender_name: "Jose",
      content: "mi tel es 602311083 y mi email es foo@bar.com",
      timestamp: "2026-04-21T09:00:00Z",
    },
  ];
  const turn = buildUserTurn(vehicle(), [], msgs, "Jose", "es");
  assert(!turn.includes("602311083"));
  assert(!turn.includes("foo@bar.com"));
  assertStringIncludes(turn, "[TELEFONO]");
  assertStringIncludes(turn, "[EMAIL]");
});

Deno.test("buildUserTurn: preserves Ricard's phone when present", () => {
  const msgs: LeadMessageRow[] = [
    {
      sender: "dealer",
      sender_name: "Ricard",
      content: "mi num es 646131565",
      timestamp: "2026-04-21T09:00:00Z",
    },
  ];
  const turn = buildUserTurn(vehicle(), [], msgs, "Jose", "es");
  assertStringIncludes(turn, "646131565");
});

Deno.test("buildUserTurn: no vehicle shows placeholder", () => {
  const turn = buildUserTurn(null, [], [], "Anon", "es");
  assertStringIncludes(turn, "(no vinculado)");
});

// ── fallback ────────────────────────────────────────────────────────────

Deno.test("fallbackReply: includes name and Ricard's phone", () => {
  const f = fallbackReply("Jose");
  assertStringIncludes(f, "Jose");
  assertStringIncludes(f, "646131565");
});

Deno.test("fallbackReply: empty name still returns a valid message", () => {
  const f = fallbackReply("");
  assertStringIncludes(f, "CodinaCars");
  assertStringIncludes(f, "646131565");
});

// ── callClaude (with mocked fetch) ──────────────────────────────────────

Deno.test("callClaude: returns text on 200", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response(
      JSON.stringify({ content: [{ type: "text", text: "Buenas!!" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
  try {
    const reply = await callClaude("fake-key", "system", [
      { role: "user", content: "hola" },
    ]);
    assertEquals(reply, "Buenas!!");
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("callClaude: throws on non-200", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response("rate limited", { status: 429 }));
  try {
    await assertRejects(() => callClaude("fake-key", "sys", []), Error, "Claude API 429");
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("callClaude: throws on empty content", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ content: [] }), { status: 200 }));
  try {
    await assertRejects(() => callClaude("k", "s", []), Error, "empty text");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ── handleRequest (full flow with stubbed Supabase + Claude) ────────────

interface StubTable {
  rows: Record<string, unknown>[];
}

function makeSupabaseStub(tables: Record<string, StubTable>) {
  const calls: { table: string; select: string; filters: Record<string, unknown> }[] = [];

  function fromTable(tableName: string) {
    let filters: Record<string, unknown> = {};
    let selectStr = "*";
    const chain = {
      select(s: string) {
        selectStr = s;
        return chain;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return chain;
      },
      neq(col: string, val: unknown) {
        filters[`!${col}`] = val;
        return chain;
      },
      ilike(col: string, pattern: string) {
        filters[`ilike:${col}`] = pattern;
        return chain;
      },
      order(_col: string, _opts?: unknown) {
        return chain;
      },
      limit(_n: number) {
        return done();
      },
    };

    function done() {
      calls.push({ table: tableName, select: selectStr, filters: { ...filters } });
      const rows = (tables[tableName]?.rows ?? []).filter((r) => {
        for (const [k, v] of Object.entries(filters)) {
          if (k.startsWith("!")) {
            if ((r as Record<string, unknown>)[k.slice(1)] === v) return false;
          } else if (k.startsWith("ilike:")) {
            const col = k.slice("ilike:".length);
            const pat = String(v).replace(/%/g, "");
            const cell = String((r as Record<string, unknown>)[col] ?? "");
            if (!cell.toLowerCase().startsWith(pat.toLowerCase())) return false;
          } else {
            if ((r as Record<string, unknown>)[k] !== v) return false;
          }
        }
        return true;
      });
      // emulate PostgREST-ish return; we always await a promise
      return Promise.resolve({ data: rows, error: null });
    }

    return chain;
  }

  // deno-lint-ignore no-explicit-any
  return { from: fromTable as any, _calls: calls } as any;
}

function makeRequest(body: unknown, opts: { secret?: string } = {}): Request {
  return new Request("http://localhost/suggest-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.secret ? { "x-app-secret": opts.secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

const DEFAULT_ENV = {
  SUGGEST_REPLY_SECRET: "test-secret",
  ANTHROPIC_API_KEY: "sk-ant-test",
  SUPABASE_URL: "http://stub",
  SUPABASE_SERVICE_ROLE_KEY: "stub-key",
};

Deno.test("handleRequest: 401 without x-app-secret", async () => {
  const res = await handleRequest(makeRequest({ leadId: 1 }), { env: DEFAULT_ENV });
  assertEquals(res.status, 401);
});

Deno.test("handleRequest: 401 with wrong x-app-secret", async () => {
  const res = await handleRequest(
    makeRequest({ leadId: 1 }, { secret: "nope" }),
    { env: DEFAULT_ENV },
  );
  assertEquals(res.status, 401);
});

Deno.test("handleRequest: 400 on missing leadId", async () => {
  const res = await handleRequest(
    makeRequest({}, { secret: "test-secret" }),
    { env: DEFAULT_ENV },
  );
  assertEquals(res.status, 400);
});

Deno.test("handleRequest: vehicle disponible → reply sin alternativas", async () => {
  const sb = makeSupabaseStub({
    leads: {
      rows: [{
        id: 10,
        company_id: 1,
        name: "Jose Luis",
        vehicle_interest: "Polo",
        vehicle_id: 5,
        estado: "nuevo",
      }],
    },
    vehicles: {
      rows: [{
        id: 5,
        company_id: 1,
        name: "VOLKSWAGEN Polo Advance",
        anio: 2021,
        km: 45000,
        precio_venta: 13980,
        estado: "disponible",
        fuel: "gasolina",
        transmission: "manual",
        cv: "95",
      }],
    },
    lead_messages: {
      rows: [{
        lead_id: 10,
        sender: "lead",
        sender_name: "Jose Luis",
        content: "Me interesa este vehículo",
        timestamp: "2026-04-20T09:00:00Z",
      }],
    },
  });
  let promptSeen: { system: string; messages: { role: string; content: string }[] } | null = null;
  const fakeClaude = (_k: string, system: string, messages: { role: "user" | "assistant"; content: string }[]) => {
    promptSeen = { system, messages };
    return Promise.resolve("Buenas Jose!! Soy Ricard");
  };
  const res = await handleRequest(
    makeRequest({ leadId: 10 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: fakeClaude },
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, true);
  assertEquals(json.reply, "Buenas Jose!! Soy Ricard");
  assertEquals(json.language, "es");
  // Verifica que el user turn final NO incluye "ALTERNATIVAS"
  assert(promptSeen, "fakeClaude should have been called");
  const finalUserTurn = promptSeen!.messages.at(-1)!.content;
  assert(!finalUserTurn.includes("ALTERNATIVAS"), "expected no alternatives block");
  assertStringIncludes(finalUserTurn, "estado: disponible");
});

Deno.test("handleRequest: vehicle reservado → reply incluye alternativas del stock", async () => {
  const sb = makeSupabaseStub({
    leads: {
      rows: [{
        id: 11,
        company_id: 1,
        name: "Marina",
        vehicle_interest: "Polo",
        vehicle_id: 5,
        estado: "nuevo",
      }],
    },
    vehicles: {
      rows: [
        {
          id: 5,
          company_id: 1,
          name: "VOLKSWAGEN Polo Advance",
          anio: 2021,
          km: 45000,
          precio_venta: 13980,
          estado: "reservado",
        },
        {
          id: 6,
          company_id: 1,
          name: "VOLKSWAGEN Polo GT",
          anio: 2022,
          km: 30000,
          precio_venta: 14500,
          estado: "disponible",
        },
        {
          id: 7,
          company_id: 1,
          name: "VOLKSWAGEN T-Cross",
          anio: 2022,
          km: 50000,
          precio_venta: 15500,
          estado: "disponible",
        },
      ],
    },
    lead_messages: {
      rows: [{
        lead_id: 11,
        sender: "lead",
        sender_name: "Marina",
        content: "Me interesa este vehículo",
        timestamp: "2026-04-20T09:00:00Z",
      }],
    },
  });
  let promptSeen = "";
  const fakeClaude = (_k: string, _s: string, messages: { role: "user" | "assistant"; content: string }[]) => {
    promptSeen = messages.at(-1)!.content;
    return Promise.resolve("Buenas Marina!! Esta reservado, pero tengo Polo GT y T-Cross");
  };
  const res = await handleRequest(
    makeRequest({ leadId: 11 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: fakeClaude },
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, true);
  assertStringIncludes(promptSeen, "ALTERNATIVAS");
  assertStringIncludes(promptSeen, "Polo GT");
  assertStringIncludes(promptSeen, "T-Cross");
});

Deno.test("handleRequest: Claude error → fallback con nombre del lead", async () => {
  const sb = makeSupabaseStub({
    leads: {
      rows: [{
        id: 12,
        company_id: 1,
        name: "Jose Luis Garcia",
        vehicle_interest: "Polo",
        vehicle_id: null,
        estado: "nuevo",
      }],
    },
    vehicles: { rows: [] },
    lead_messages: { rows: [] },
  });
  const fakeClaude = () => Promise.reject(new Error("Claude API 500: boom"));
  const res = await handleRequest(
    makeRequest({ leadId: 12 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: fakeClaude },
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, false);
  assertStringIncludes(json.error, "Claude API 500");
  assertStringIncludes(json.fallback, "Jose"); // firstNameOnly
  assert(!json.fallback.includes("Garcia"));
});

Deno.test("handleRequest: detecta catalán cuando el último mensaje del lead lo es", async () => {
  const sb = makeSupabaseStub({
    leads: {
      rows: [{
        id: 13,
        company_id: 1,
        name: "Francesc",
        vehicle_interest: null,
        vehicle_id: null,
        estado: "nuevo",
      }],
    },
    vehicles: { rows: [] },
    lead_messages: {
      rows: [{
        lead_id: 13,
        sender: "lead",
        sender_name: "Francesc",
        content: "Bona tarda, teniu disponible encara el vehicle?",
        timestamp: "2026-04-20T09:00:00Z",
      }],
    },
  });
  const fakeClaude = () => Promise.resolve("Bona tarda Francesc!!");
  const res = await handleRequest(
    makeRequest({ leadId: 13 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: fakeClaude },
  );
  const json = await res.json();
  assertEquals(json.language, "ca");
});

Deno.test("handleRequest: lead con teléfono/email en mensajes se sanitiza antes del prompt", async () => {
  const sb = makeSupabaseStub({
    leads: {
      rows: [{
        id: 14,
        company_id: 1,
        name: "Shohel",
        vehicle_interest: null,
        vehicle_id: null,
        estado: "nuevo",
      }],
    },
    vehicles: { rows: [] },
    lead_messages: {
      rows: [{
        lead_id: 14,
        sender: "lead",
        sender_name: "Shohel",
        content: "Es mi WhatsApp personal 602311083 y mi email shohel@test.com",
        timestamp: "2026-04-20T09:00:00Z",
      }],
    },
  });
  let promptUser = "";
  const fakeClaude = (_k: string, _s: string, msgs: { role: "user" | "assistant"; content: string }[]) => {
    promptUser = msgs.at(-1)!.content;
    return Promise.resolve("ok");
  };
  await handleRequest(
    makeRequest({ leadId: 14 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: fakeClaude },
  );
  assert(!promptUser.includes("602311083"));
  assert(!promptUser.includes("shohel@test.com"));
  assertStringIncludes(promptUser, "[TELEFONO]");
  assertStringIncludes(promptUser, "[EMAIL]");
});

Deno.test("handleRequest: lead no encontrado → 404 con fallback", async () => {
  const sb = makeSupabaseStub({ leads: { rows: [] }, vehicles: { rows: [] }, lead_messages: { rows: [] } });
  const res = await handleRequest(
    makeRequest({ leadId: 99 }, { secret: "test-secret" }),
    { env: DEFAULT_ENV, supabase: sb, callClaudeFn: () => Promise.resolve("never") },
  );
  assertEquals(res.status, 404);
  const json = await res.json();
  assertEquals(json.ok, false);
  assertStringIncludes(json.fallback, "CodinaCars");
});
