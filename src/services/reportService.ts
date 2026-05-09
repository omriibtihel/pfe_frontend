/**
 * Backward-compatible re-export. The implementation lives in `./report/`,
 * split by responsibility (types, theme, analysis, pdf builder, sections).
 */
export { DEFAULT_SECTIONS, generateDatasetReport } from './report';
export type { ReportInput, ReportSections } from './report';
