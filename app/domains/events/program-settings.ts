/**
 * Where the event configuration form (`EventConfigForm.vue`) is shown:
 * - `full`: the page that creates an event.
 * - `settings`: the Settings tab of an existing event.
 *
 * Both modes show and save the same fields. Only the layout and the event type field differ.
 */
export type EventProgramSettingsMode = 'full' | 'settings'
