import * as fs from "fs";
import * as path from "path";

import { globSync } from "glob";

/**
 * 지정된 절대 경로의 파일 내용을 읽어 문자열로 반환합니다.
 * 경로 유효성, 파일 존재 여부, 파일 타입 등을 검사합니다.
 * @param {string} absolutePath - 읽을 파일의 절대 경로.
 * @returns {string} 파일 내용 또는 에러 메시지.
 */
export function readFileJs(absolutePath) {
  // 보안을 위해 실제 서비스에서는 더 엄격한 경로 검증이 필요합니다.
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
    return fs.readFileSync(absolutePath, "utf-8");
  } catch (e) {
    return `Error reading file: ${e.message}`;
  }
}

// ls 이름과 동일
export function listDirectoryJs(absolutePath) {
  /**
   * 지정된 절대 경로의 디렉토리 내용을 나열합니다.
   * 이 함수는 Gemini CLI 프로젝트의 list_directory 도구의 JS/TS 버전입니다.
   */
  if (!path.isAbsolute(absolutePath)) {
    return `Error: Path must be absolute. Received: ${absolutePath}`;
  }
  if (!fs.existsSync(absolutePath)) {
    return `Error: Directory not found at ${absolutePath}`;
  }
  if (!fs.lstatSync(absolutePath).isDirectory()) {
    return `Error: Path is not a directory: ${absolutePath}`;
  }

  try {
    const items = fs.readdirSync(absolutePath);
    return items.join("\n");
  } catch (e) {
    return `Error listing directory: ${e.message}`;
  }
}

export function writeFileJs(absolutePath, content) {
  /**
   * 지정된 절대 경로에 파일 내용을 씁니다.
   * 파일이 존재하면 덮어쓰고, 없으면 새로 생성합니다.
   */
  if (!path.isAbsolute(absolutePath)) {
    return `Error: Path must be absolute. Received: ${absolutePath}`;
  }

  // 보안을 위해 특정 디렉토리 내에서만 쓰기를 허용하는 로직을 추가할 수 있습니다.
  // 예: if (!absolutePath.startsWith(path.join(process.cwd(), 'safe_dir'))) { ... }

  try {
    fs.writeFileSync(absolutePath, content, "utf-8");
    return `Successfully wrote to file: ${absolutePath}`;
  } catch (e) {
    return `Error writing to file: ${e.message}`;
  }
}

// grep 이름과 동일
export function searchFileContentJs(
  pattern,
  include,
  searchPath = process.cwd()
) {
  /**
   * 지정된 디렉토리 내의 파일 내용에서 정규 표현식 패턴을 검색합니다.
   * @param pattern 검색할 정규 표현식 패턴.
   * @param include 검색할 파일을 필터링할 glob 패턴 (예: '*.js', 'src/**').
   * @param searchPath 검색을 시작할 디렉토리의 절대 경로 (기본값은 현재 작업 디렉토리).
   */
  try {
    const results = [];
    let filesToSearch;
    const globOptions = {
      cwd: searchPath,
      absolute: true, // 절대 경로 반환
      nodir: true, // 디렉토리는 제외
      ignore: ["node_modules/**", ".git/**"], // 일반적으로 무시할 디렉토리
    };

    if (include) {
      filesToSearch = glob.sync(include, globOptions);
    } else {
      // include 패턴이 없으면 모든 파일을 검색 (주의: 매우 느릴 수 있음)
      // 여기서는 간단히 현재 디렉토리와 하위 디렉토리의 모든 파일을 검색하도록 구현합니다.
      // 실제로는 더 정교한 파일 탐색 로직이 필요합니다.
      filesToSearch = glob.sync("**/*", globOptions);
    }

    const regex = new RegExp(pattern, "gm"); // 'g'는 모든 일치 항목, 'm'은 여러 줄
    for (const filePath of filesToSearch) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        let match;
        let lineNumber = 1;
        const lines = content.split("\n");
        for (const line of lines) {
          if (regex.test(line)) {
            results.push(`${filePath}:${lineNumber}: ${line}`);
          }
          lineNumber++;
        }
        regex.lastIndex = 0; // 다음 파일 검색을 위해 lastIndex 초기화
      } catch (fileReadError) {
        // 파일 읽기 오류는 무시하고 다음 파일로 진행
        // console.warn(`Warning: Could not read file ${filePath}: ${fileReadError.message}`);
      }
    }

    if (results.length === 0) {
      return `No matches found for pattern '${pattern}' in '${searchPath}'${
        include ? ` with include '${include}'` : ""
      }.`;
    }
    return results.join("\n");
  } catch (e) {
    return `Error searching file content: ${e.message}`;
  }
}

export function globJs(pattern, searchPath = process.cwd()) {
  //  지정된 glob 패턴과 일치하는 파일들의 절대 경로 목록을 찾아서 반환합니다.
  //  @param {string} pattern 검색할 glob 패턴 (예: '**/*.js').
  //  @param {string} [searchPath] 검색을 시작할 디렉토리의 절대 경로 (기본값은 현재 작업 디렉토리).
  //  @returns {string[]} 일치하는 파일들의 절대 경로 배열.
  try {
    const globOptions = {
      cwd: searchPath,
      absolute: true, // 절대 경로 반환
      nodir: true, // 디렉토리는 제외
      ignore: ["node_modules/**", ".git/**"], // 일반적으로 무시할 디렉토리
    };

    const files = globSync(pattern, globOptions);

    if (files.length === 0) {
      return `No files found matching pattern '${pattern}' in '${searchPath}'.`;
    }
    return files.join("\n");
  } catch (e) {
    return `Error performing glob search: ${e.message}`;
  }
}

/**
 * 여러 파일의 내용을 한 번에 읽어서 그 내용을 하나의 문자열로 합쳐서 반환합니다.
 * @param {string[]} paths 읽을 파일 경로 또는 glob 패턴 목록.
 * @param {string[]} [exclude=[]] 제외할 glob 패턴 목록.
 * @param {string[]} [include=[]] 추가로 포함할 glob 패턴 목록.
 * @param {boolean} [recursive=true] 재귀적으로 검색할지 여부 (glob 패턴에 **가 포함된 경우).
 * @param {boolean} [useDefaultExcludes=true] 기본 제외 패턴 (node_modules, .git 등)을 사용할지 여부.
 */
export function readManyFilesJs(
  paths,
  exclude = [],
  include = [],
  recursive = true,
  useDefaultExcludes = true
) {
  try {
    // 모든 파일 경로를 저장할 배열
    const allFilePaths = [];

    // 기본 제외 패턴 설정
    const defaultExcludes = useDefaultExcludes
      ? [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          "temp/**",
          "*.log",
          "*.tmp",
          "*.bak",
        ]
      : [];

    // 최종 제외 패턴: 기본 제외 패턴 + 사용자 지정 제외 패턴
    const finalExcludes = [...defaultExcludes, ...exclude];

    // globSync 옵션 설정
    const globOptions = {
      absolute: true, // 절대 경로로 반환
      nodir: true, // 디렉토리 경로는 제외
      ignore: finalExcludes, // 제외할 패턴
    };

    // paths와 include를 합쳐서 glob 패턴으로 사용
    const patternsToGlob = [...paths, ...include];

    // 패턴별 파일 검색
    for (const pattern of patternsToGlob) {
      const files = glob.sync(pattern, globOptions); // globSync로 파일 목록 조회
      for (const file of files) {
        // 중복 파일을 제거하기 위해 배열에 추가 전에 존재 여부 확인
        if (!allFilePaths.includes(file)) {
          allFilePaths.push(file);
        }
      }
    }

    // 검색된 파일이 없을 경우
    if (allFilePaths.length === 0) {
      return `No files found matching the provided patterns.`;
    }

    // 파일 내용을 합쳐서 반환할 문자열
    let combinedContent = "";

    // 모든 파일 읽기
    for (const filePath of allFilePaths) {
      try {
        const content = fs.readFileSync(filePath, "utf-8"); // 파일 내용 읽기
        combinedContent += `--- ${filePath} ---\n`; // 파일 경로 표시
        combinedContent += content; // 파일 내용 추가
        combinedContent += "\n\n"; // 파일 간 구분을 위해 추가 줄바꿈
      } catch (fileReadError) {
        // 파일 읽기 오류 처리
        combinedContent += `--- Error reading ${filePath}: ${fileReadError.message} ---\n\n`;
      }
    }

    return combinedContent;
  } catch (e) {
    // 전체적인 에러 처리
    return `Error in readManyFiles: ${e.message}`;
  }
}

// --- memoryTool을 위한 파일 기반 저장소 ---
const MEMORY_FILE_PATH = path.join(process.cwd(), "llm_memory.json");
let memoryStore = new Map(); // key-value 형태로 저장

// 메모리를 파일에서 로드하는 함수
function loadMemoryFromFile() {
  try {
    if (fs.existsSync(MEMORY_FILE_PATH)) {
      const data = fs.readFileSync(MEMORY_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      // JSON.parse로 객체가 된 것을 Map으로 다시 변환
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error(`Error loading memory from file: ${e.message}`);
  }
  return new Map(); // 파일이 없거나 오류 발생 시 빈 Map 반환
}

// 메모리를 파일에 저장하는 함수
function saveMemoryToFile(store) {
  try {
    // Map을 일반 객체로 변환하여 JSON으로 저장
    const obj = Object.fromEntries(store);
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error(`Error saving memory to file: ${e.message}`);
  }
}

// 애플리케이션 시작 시 메모리 로드
memoryStore = loadMemoryFromFile();
console.log(
  `Memory loaded from ${MEMORY_FILE_PATH}. Initial facts: ${memoryStore.size}`
);

// --- saveMemoryJs 함수 (수정) ---
export function saveMemoryJs(fact) {
  /**
   * 특정 사실을 LLM의 장기 기억에 저장합니다.
   * @param fact 저장할 사실 문자열.
   */
  const timestamp = new Date().toISOString();
  // 사실 자체를 키로 사용하거나, 더 복잡한 키 생성 로직을 사용할 수 있습니다.
  // 여기서는 간단히 'fact_' 접두사와 타임스탬프를 사용합니다.
  const key = `fact_${timestamp}`;
  memoryStore.set(key, fact);
  saveMemoryToFile(memoryStore); // 변경 사항을 파일에 저장
  return `Fact saved to memory with key: ${key}. Total facts: ${memoryStore.size}`;
}

// --- retrieveMemoryJs 함수 (수정) ---
export function retrieveMemoryJs(key) {
  /**
   * 저장된 특정 사실을 키를 사용하여 조회합니다.
   * @param key 조회할 사실의 키.
   */
  if (memoryStore.has(key)) {
    return `Retrieved fact for key '${key}': ${memoryStore.get(key)}`;
  }
  return `No fact found for key: ${key}`;
}

// --- listAllMemoryJs 함수 (수정) ---
export function listAllMemoryJs() {
  /**
   * 저장된 모든 사실을 나열합니다.
   */
  if (memoryStore.size === 0) {
    return "No facts currently stored in memory.";
  }
  let result = "Stored facts:\n";
  for (const [key, value] of memoryStore.entries()) {
    result += `- ${key}: ${value}\n`;
  }
  return result;
}

/**
 * 테스트에 사용될 README 파일의 절대 경로입니다.
 * 스크립트 실행 위치에 'test_readme.md' 파일이 없으면 자동으로 생성합니다.
 * @type {string}
 */
export const testFilePath = path.join(process.cwd(), "test_readme.md");

// 테스트용 파일이 없으면 생성
if (!fs.existsSync(testFilePath)) {
  const fileContent = `# Test README for Ollama JS Client

This is a sample file to demonstrate reading capabilities using Ollama's JS client.
You can replace this with any other file path on your system.`;
  fs.writeFileSync(testFilePath, fileContent, "utf-8");
  console.log(`[시스템] 테스트용 파일 생성 완료: ${testFilePath}`);
}

// 테스트용 추가 파일 생성
export const testSearchFilePath = path.join(process.cwd(), "test_search_dir");
// search_file_content 테스트용
if (!fs.existsSync(testSearchFilePath)) {
  fs.mkdirSync(testSearchFilePath);
  fs.writeFileSync(
    path.join(testSearchFilePath, "file1.txt"),
    "Hello World!\nThis is a test file.\nAnother line with World.",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(testSearchFilePath, "file2.js"),
    "function greet() {\n  console.log('Hello from JS!');\n}\n// Some other code",
    "utf-8"
  );
  console.log(`테스트용 검색 디렉토리 및 파일 생성됨: ${testSearchFilePath}`);

  // read_many_files 테스트용
  fs.writeFileSync(
    path.join(testSearchFilePath, "sub_dir/sub_file.md"),
    "# Sub Directory File\n\nThis is a file in a subdirectory.",
    "utf-8"
  );
  console.log(`테스트용 검색 디렉토리 및 파일 생성됨: ${testSearchFilePath}`);
}
