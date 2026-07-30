/**
 * Contraseñas que no se aceptan aunque cumplan la longitud mínima (TAL-69, S3).
 *
 * La auditoría del 2026-07-24 encontró que la única regla era "ocho caracteres",
 * y que la dueña del CRM tenía literalmente `12345678`. Ocho caracteres no
 * significan nada si son los ocho que cualquiera prueba primero.
 *
 * **El mínimo se queda en 8 a propósito** (decisión tomada con el equipo): lo que
 * se descarta no es la longitud corta, sino lo adivinable. Subir el mínimo
 * molesta a todo el mundo y no habría impedido `password1234`.
 *
 * Este módulo es lógica pura y NO debe importar `./_generated/api`: lo usa
 * `auth.ts`, que ya está en la maraña de ciclos que rompe la inferencia de tipos
 * de Convex (ver la nota de `correo.ts`).
 */

/**
 * Las que de verdad se prueban primero. No pretende ser exhaustiva —para eso
 * haría falta consultar un servicio de filtraciones, que es otra tarea— sino
 * cubrir lo que alguien escribe cuando tiene prisa y le piden una contraseña.
 *
 * Van sin acentos y en minúsculas porque así se compara (ver `normalizar`).
 * Se incluyen las variantes del propio producto: son justo las que se le ocurren
 * a quien está dando de alta a su equipo.
 */
const PROHIBIDAS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "contrasena",
  "contrasena1",
  "contrasena123",
  "micontrasena",
  "qwertyui",
  "qwerty123",
  "qwertyuiop",
  "asdfghjk",
  "asdfghjkl",
  "zxcvbnm1",
  "11111111",
  "00000000",
  "abcd1234",
  "abc12345",
  "a1b2c3d4",
  "iloveyou",
  "princess",
  "sunshine",
  "welcome1",
  "welcome123",
  "admin123",
  "administrador",
  "letmein1",
  "trustno1",
  "superman",
  "starwars",
  "whatever",
  "computer",
  "football",
  "baseball",
  "dragon123",
  "monkey123",
  "master123",
  "shadow123",
  "hunter123",
  "batman123",
  "michael1",
  "jennifer",
  "freedom1",
  "vibecrm",
  "vibecrm1",
  "vibecrm123",
  "vibe-crm",
  "vibecrm2026",
  "talentnetwork",
  "talentacademy",
  "crm123456",
]);

/** Secuencias corridas de las que se sacan las subcadenas prohibidas. */
const CORRIDAS = [
  "0123456789",
  "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

/**
 * Minúsculas y sin acentos, para que `Contraseña` y `contrasena` cuenten como la
 * misma. `NFD` separa la tilde de su letra y `\p{Diacritic}` borra las marcas
 * que quedan sueltas — se escribe así, y no con un rango de puntos de código,
 * porque esos caracteres son invisibles en el editor y nadie puede revisarlos.
 */
function normalizar(contrasena: string): string {
  return contrasena
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** ¿La contraseña ENTERA es un tramo de una secuencia corrida, al derecho o al revés? */
function esCorrida(valor: string): boolean {
  const alReves = [...valor].reverse().join("");
  return CORRIDAS.some((fila) => fila.includes(valor) || fila.includes(alReves));
}

/**
 * `true` si esta contraseña no debe aceptarse. Solo mira la contraseña: la
 * librería pasa a `validatePasswordRequirements` únicamente ese valor
 * (`Password.js:50`), así que no se puede comparar con el correo de la persona.
 * Cubrir ese caso exigiría envolver también el proveedor, y no compensa.
 */
export function esContrasenaInservible(contrasena: string): boolean {
  const valor = normalizar(contrasena);
  if (PROHIBIDAS.has(valor)) return true;
  // Todo el mismo carácter: "aaaaaaaa", "88888888".
  if (/^(.)\1*$/.test(valor)) return true;
  if (esCorrida(valor)) return true;
  return false;
}
