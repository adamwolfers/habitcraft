/** Types for render.mjs, which is plain JS so CI's Node 20 can run it. */

export interface Scenario {
  /** The test's title, exactly as written. */
  title: string;
  /** The 1-based line of its `test(` call. */
  line: number;
  /** The test body, dedented, without `await` and trailing semicolons. */
  steps: string;
}

export interface TestFile {
  /** The file's name inside tests/. */
  file: string;
  /** The file's leading doc comment, without its `*` gutter. */
  description: string;
  scenarios: Scenario[];
}

export function parseTestFile(source: string, file: string): TestFile;
export function renderPage(files: TestFile[]): string;
