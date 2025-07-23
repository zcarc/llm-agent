import * as fs from "fs";
import * as path from "path";

export function readFileJs(absolutePath: string): string {
  /**
   * 지정된 절대 경로의 파일 내용을 읽어 문자열로 반환합니다.
   * 이 함수는 Gemini CLI 프로젝트의 read_file 도구의 JS/TS 버전입니다.
   */
  // 보안을 위해 실제 사용 시에는 경로 검증 및 권한 관리가 매우 중요합니다.
  // 여기서는 간단한 예시를 위해 최소한의 검증만 포함합니다.
  if (!path.isAbsolute(absolutePath)) {
    return `Error: Path must be absolute. Received: ${absolutePath}`;
  }
  if (!fs.existsSync(absolutePath)) {
    return `Error: File not found at ${absolutePath}`;
  }
  if (!fs.lstatSync(absolutePath).isFile()) {
    return `Error: Path is not a file: ${absolutePath}`;
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    return content;
  } catch (e: any) {
    return `Error reading file: ${e.message}`;
  }
}

// 테스트용 파일 생성 (실제 README.md 경로로 대체 가능)
// 이 스크립트를 실행하는 디렉토리에 test_readme.md 파일을 생성합니다.
export const testFilePath = path.join(process.cwd(), "test_readme.md");
if (!fs.existsSync(testFilePath)) {
  fs.writeFileSync(
    testFilePath,
    `# Test README for Ollama JS Client\n\nThis is a sample file to demonstrate
 reading capabilities using Ollama's JS client.\nYou can replace this with any other file path on your system.`,
    "utf-8"
  );
  console.log(`테스트용 파일 생성됨: ${testFilePath}`);
}
