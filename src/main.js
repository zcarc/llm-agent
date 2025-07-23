#!/usr/bin/env node

import ollama from "ollama";
import * as fs from "fs";
import * as path from "path";
import {
  globJs,
  listDirectoryJs,
  readFileJs,
  readManyFilesJs,
  searchFileContentJs,
  saveMemoryJs,
  listAllMemoryJs,
  searchMemoryJs,
} from "./tools.js";
import readline from "readline";
import ora from "ora";

// --- 설정 (Configuration) ---

/** 사용할 Ollama 모델 이름 */
const MODEL_NAME = "qwen3";

/**
 * Ollama에 제공할 도구의 JSON 스키마입니다.
 * LLM이 이 스키마를 보고 함수의 용도와 필요한 인자를 파악합니다.
 */
const OLLAMA_TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "지정된 절대 경로의 파일 내용을 읽어 문자열로 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          absolute_path: {
            type: "string",
            description: "읽을 파일의 절대 경로",
          },
        },
        required: ["absolute_path"],
      },
    },
  },
  // --- 새로 추가할 list_directory 도구 스키마 ---
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "지정된 절대 경로의 디렉토리 내용을 나열합니다.",
      parameters: {
        type: "object",
        properties: {
          absolute_path: {
            type: "string",
            description: "목록을 조회할 디렉토리의 절대 경로",
          },
        },
        required: ["absolute_path"],
      },
    },
  },
  // {
  //   type: "function",
  //   function: {
  //     name: "write_file",
  //     description:
  //       "지정된 절대 경로에 파일 내용을 씁니다. 파일이 존재하면 덮어쓰지 않습니다. 없으면 새로 생성합니다.",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         absolute_path: {
  //           type: "string",
  //           description: "내용을 쓸 파일의 절대 경로",
  //         },
  //         content: {
  //           type: "string",
  //           description: "파일에 쓸 내용",
  //         },
  //       },
  //       required: ["absolute_path", "content"],
  //     },
  //   },
  // },
  {
    type: "function",
    function: {
      name: "search_file_content",
      description:
        "지정된 디렉토리 내의 파일 내용에서 정규 표현식 패턴을 검색합니다. 일치하는 줄과 해당 파일 경로, 줄 번호를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "검색할 정규 표현식 패턴.",
          },
          include: {
            type: "string",
            description:
              "검색할 파일을 필터링할 glob 패턴 (예: '*.js', 'src/**').",
          },
          searchPath: {
            type: "string",
            description:
              "검색을 시작할 디렉토리의 절대 경로 (기본값은 현재 작업 디렉토리).",
          },
        },
        required: ["pattern"], // pattern은 필수, include와 searchPath는 선택 사항
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description:
        "지정된 glob 패턴과 일치하는 파일들의 절대 경로 목록을 찾아서 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "검색할 glob 패턴 (예: '**/*.js', 'docs/*.md').",
          },
          searchPath: {
            type: "string",
            description:
              "검색을 시작할 디렉토리의 절대 경로 (기본값은 현재 작업 디렉토리).",
          },
        },
        required: ["pattern"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "read_many_files",
      description:
        "여러 파일의 내용을 한 번에 읽어서 그 내용을 하나의 문자열로 합쳐서 반환합니다. 파일 경로 목록이나 glob 패턴을 입력으로 받습니다.",
      parameters: {
        type: "object",
        properties: {
          paths: {
            type: "array",
            items: { type: "string" },
            description: "읽을 파일 경로 또는 glob 패턴 목록.",
          },
          searchPath: {
            type: "string",
            description:
              "검색을 시작할 디렉토리의 절대 경로 (기본값은 현재 작업 디렉토리).",
          },
          exclude: {
            type: "array",
            items: { type: "string" },
            description: "제외할 glob 패턴 목록.",
          },
          include: {
            type: "array",
            items: { type: "string" },
            description: "추가로 포함할 glob 패턴 목록.",
          },
          recursive: {
            type: "boolean",
            description:
              "재귀적으로 검색할지 여부 (glob 패턴에 **가 포함된 경우).",
            default: true,
          },
          useDefaultExcludes: {
            type: "boolean",
            description:
              "기본 제외 패턴 (node_modules, .git 등)을 사용할지 여부.",
            default: true,
          },
        },
        required: ["paths"],
      },
    },
  },

  // src/main.ts 파일 내의 OLLAMA_TOOLS_SCHEMA 배열 중 save_memory 스키마 부분
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "사용자의 이름, 선호도, 또는 대화 중에 언급된 중요한 사실과 같은 특정 정보를 나의 장기 기억에 저장합니다. 이 정보는 나중에 다시 사용될 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description:
              "기억할 구체적인 사실. (예: '내 이름은 김철수야', '내가 가장 좋아하는 색은 파란색이야')",
          },
        },
        required: ["fact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description:
        "사용자의 이름, 선호도 등 특정 키워드를 포함하는 사실을 나의 장기 기억 속에서 검색합니다.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "검색할 키워드 (예: '이름', '색깔', '좋아하는 것')",
          },
        },
        required: ["query"],
      },
    },
  },
  // --- (선택 사항) list_all_memory 도구 스키마 ---
  {
    type: "function",
    function: {
      name: "list_all_memory",
      description:
        "사용자에 대해 내가 기억하고 있는 모든 사실들의 목록을 나의 장기 기억 속에서 찾아서 보여줍니다. 사용자가 '내가 뭘 기억하고 있어?' 또는 '내 이름 알아?' 와 같이 불분명하게 질문할 때 유용합니다.",
      parameters: {
        type: "object",
        properties: {}, // 인자 없음
        required: [],
      },
    },
  },
];

/**
 * LLM이 호출할 함수 이름과 실제 JavaScript 함수를 매핑합니다.
 */
const availableFunctions = {
  read_file: readFileJs,
  list_directory: listDirectoryJs,
  // write_file: writeFileJs,
  // run_shell_command: runShellCommandJs,
  search_file_content: searchFileContentJs,
  glob: globJs,
  read_many_files: readManyFilesJs,
  save_memory: saveMemoryJs, // <-- 여기에 saveMemoryJs가 매핑됩니다.
  search_memory: searchMemoryJs,
  list_all_memory: listAllMemoryJs, // <-- (선택 사항)
};

// --- 핵심 로직 (Core Logic) ---

/**
 * 사용자의 쿼리를 받아 Ollama와 대화하며, 필요 시 도구를 호출하고 최종 답변을 반환합니다.
 * @param {string} userQuery - 사용자가 입력한 질문.
 * @returns {Promise<string>} LLM의 최종 답변.
 */

// processChatWithTools 함수는 이제 userQuery 대신 currentMessages 배열을 받습니다.
async function processChatWithTools(currentMessages) {
  // 1. 안전을 위해 작업할 복사본을 만듭니다.
  let workingMessages = [...currentMessages];

  while (true) {
    // 1. LLM에 메시지와 사용 가능한 도구 목록을 전송
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: workingMessages,
      tools: OLLAMA_TOOLS_SCHEMA,
      stream: false,
    });

    const assistantMessage = response.message;
    workingMessages.push(assistantMessage); // LLM 응답을 기록에 추가

    console.log(
      "### assistantMessage:  ",
      JSON.stringify(assistantMessage, null, 2)
    );

    // 2. LLM이 도구 사용을 요청했는지 확인
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return workingMessages;
    }

    // 3. 도구 호출 실행
    console.log(`\n[LLM] 도구 호출을 요청했습니다...`);
    const toolCalls = assistantMessage.tool_calls;

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionArgs = toolCall.function.arguments;
      const functionToCall = availableFunctions[functionName];

      let toolOutput = "";
      if (functionToCall) {
        console.log(
          `  [도구] '${functionName}' 실행 (인자: ${JSON.stringify(
            functionArgs
          )})`
        );
        toolOutput = functionToCall(functionArgs);
        // if (functionName === "read_file" || functionName === "list_directory") {
        //   toolOutput = functionToCall(functionArgs.absolute_path);
        // }
        // else if (functionName === "write_file") {
        //   toolOutput = functionToCall(
        //     functionArgs.absolute_path,
        //     functionArgs.content
        //   );
        // }
        // else if (functionName === "run_shell_command") {
        //   toolOutput = functionToCall(
        //     functionArgs.command,
        //     functionArgs.directory
        //   );
        // }
        // else if (functionName === "search_file_content") {
        //   toolOutput = functionToCall(
        //     functionArgs.pattern,
        //     functionArgs.include,
        //     functionArgs.searchPath
        //   );
        // } else if (functionName === "glob") {
        //   toolOutput = functionToCall(
        //     functionArgs.pattern,
        //     functionArgs.searchPath
        //   );
        // } else if (functionName === "read_many_files") {
        //   toolOutput = functionToCall(
        //     functionArgs.paths,
        //     functionArgs.searchPath,
        //     functionArgs.exclude,
        //     functionArgs.include,
        //     functionArgs.recursive,
        //     functionArgs.useDefaultExcludes
        //   );
        //   // save_memory에 대한 인자 처리 로직
        // } else if (functionName === "save_memory") {
        //   toolOutput = functionToCall(functionArgs.fact);
        //   // (선택 사항) retrieve_memory에 대한 인자 처리 로직
        // } else if (functionName === "retrieve_memory") {
        //   toolOutput = functionToCall(functionArgs.key);
        //   // (선택 사항) list_all_memory에 대한 인자 처리 로직
        // } else if (functionName === "list_all_memory") {
        //   toolOutput = functionToCall();
        // } else {
        //   toolOutput = `Error: Unhandled tool arguments for ${functionName}`;
        // }

        console.log(
          `  [도구] 실행 완료. 결과를 LLM에 전달하여 다음 답변을 요청합니다.`
        );
      } else {
        // ✨ 개선점 1: 알 수 없는 도구 처리
        console.error(`  [오류] 알 수 없는 도구: ${functionName}`);
        toolOutput = `Error: Tool '${functionName}' not found.`;
      }

      // 4. (가장 중요) 도구 실행 결과를 'tool' 역할 메시지로 만들어 기록에 추가
      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: functionName,
        content: toolOutput,
      });
    }
    // 'while' 루프의 처음으로 돌아가 도구 실행 결과가 포함된 대화 기록을 다시 LLM에 보냄
  }
}

/**
 * 프로그램 전체의 대화 기록을 저장하는 배열
 * @type {Array<Object>}
 */
let messages = [
  // 시스템 메시지를 추가하여 LLM에게 컨텍스트를 제공합니다.
  {
    role: "system",
    content: `You are a helpful assistant. The user's current working directory is '${process.cwd()}'. When you use tools that require a path, use this path as the default unless the user specifies a different one.`,
  },
];

/**
 * 현재 대화 기록을 타임스탬프가 포함된 JSON 파일로 저장합니다.
 */
const saveChatHistory = () => {
  if (messages.length <= 1) {
    console.log("\n대화 내용이 없어 저장하지 않습니다.");
    return;
  }

  const historyDir = path.join(process.cwd(), "chat_history");
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir);
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-"); // 파일명으로 쓰기 좋은 형태로 변환
  const fileName = `chat_${timestamp}.json`;
  const filePath = path.join(historyDir, fileName);

  try {
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), "utf-8");
    console.log(`\n대화 기록이 ${filePath} 에 저장되었습니다.`);
  } catch (e) {
    console.error(`\n대화 기록 저장 중 오류 발생: ${e.message}`);
  }
};

// --- 실행 (Execution) ---
async function main() {
  // console.log(`[시스템] 테스트할 파일 경로: ${testFilePath}`);
  // console.log(`[시스템] 테스트할 검색 디렉토리: ${testSearchFilePath}`);

  // Ctrl+C 종료 이벤트 리스너 설정
  // process.on("SIGINT", () => {
  //   saveChatHistory();
  //   process.exit();
  // });

  // --- 사용자 입력 추가 ---
  console.log(
    "\n--- 이제부터 사용자 입력을 받습니다. (종료하려면 'exit' 입력) ---"
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("SIGINT", () => {
    console.log("\nCtrl+C가 감지되었습니다. 대화 기록을 저장하고 종료합니다.");
    saveChatHistory();
    rl.close(); // readline 인터페이스를 정상적으로 닫습니다.
  });

  function askQuestion() {
    console.log(`\n▶️  대화를 시작합니다.`);
    rl.question("You: ", async (userQuery) => {
      if (userQuery.toLowerCase() === "exit") {
        saveChatHistory();
        rl.close();
        return;
      }

      // 현재 사용자 입력을 messages 배열에 추가합니다.
      messages.push({ role: "user", content: userQuery });

      const spinner = ora({
        text: "Thinking...",
        spinner: "dots", // 원하는 스피너 스타일의 이름을 여기에 넣습니다.
      }).start();

      try {
        // 1. processChatWithTools로부터 '업데이트된 전체 배열'을 받습니다.
        const updatedMessages = await processChatWithTools(messages);

        // 2. 전역 messages를 반환받은 새 배열로 교체합니다. (let으로 선언했기에 가능)
        messages = updatedMessages;

        // AI의 응답이 오면 스피너를 멈춥니다.
        spinner.stop();

        // 3. 최종 답변은 이제 새 배열의 마지막 요소입니다.
        const finalAnswer = messages[messages.length - 1].content;

        console.log(`LLM 최종 답변: ${finalAnswer}`);
      } catch (e) {
        console.error(`\n오류 발생: ${e.message}`);
      }
      askQuestion();
    });
  }

  askQuestion();

  // --- 새로운 사용자 쿼리 예시: save_memory ---
  // let userQuery17 = `내 이름은 김철수야. 이 사실을 기억해줘.`;
  // console.log(`\n--- 열일곱 번째 쿼리: save_memory (이름 기억) ---`);
  // try {
  //   const finalAnswer17 = await processChatWithTools(userQuery17);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // let userQuery18 = `내가 가장 좋아하는 색깔은 파란색이야. 이것도 기억해줘.`;
  // console.log(`\n--- 열여덟 번째 쿼리: save_memory (색깔 기억) ---`);
  // try {
  //   const finalAnswer18 = await processChatWithTools(userQuery18);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // // --- (선택 사항) 저장된 메모리 조회 예시 ---
  // let userQuery19 = `내가 기억하고 있는 모든 사실을 나열해줘.`;
  // console.log(`\n--- 열아홉 번째 쿼리: list_all_memory ---`);
  // try {
  //   const finalAnswer19 = await processChatWithTools(userQuery19);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // --- 새로운 사용자 쿼리 예시: read_many_files ---
  // const subDirPath = path.join(testSearchFilePath, "sub_dir");
  // let userQuery15 = `'${testSearchFilePath}' 디렉토리와 그 하위 디렉토리의 모든 '.txt' 파일과 '.md' 파일의 내용을 한 번에 읽어줘.`;
  // console.log(`\n--- 열다섯 번째 쿼리: read_many_files (여러 파일 읽기) ---`);
  // try {
  //   const finalAnswer15 = await processChatWithTools(userQuery15);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }
  // const subDirPath = path.join(testSearchFilePath, "sub_dir");
  // let userQuery15 = `'${testSearchFilePath}' 디렉토리와 그 하위 디렉토리의 모든 '.txt' 파일과 '.md' 파일의 내용을 한 번에 읽어줘.`;
  // console.log(`\n--- 열다섯 번째 쿼리: read_many_files (여러 파일 읽기) ---`);
  // try {
  //   const finalAnswer15 = await processChatWithTools(userQuery15);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // let userQuery16 = `'${testSearchFilePath}' 디렉토리의 모든 파일 내용을 읽어줘. (기본 제외 패턴 사용 안 함)`;
  // console.log(
  //   `\n--- 열여섯 번째 쿼리: read_many_files (모든 파일 읽기, 제외 패턴 없음) ---`
  // );
  // try {
  //   const finalAnswer16 = await processChatWithTools(userQuery16);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // --- 새로운 사용자 쿼리 예시: glob ---
  // let userQuery9 = ` 디렉토리에서 모든 '.js' 파일의 경로를 찾아줘.`;
  // console.log(`\n--- 아홉 번째 쿼리: glob (모든 .js 파일) ---`);
  // try {
  //   const finalAnswer9 = await processChatWithTools(userQuery9);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // let userQuery10 = `'${testSearchFilePath}' 디렉토리에서 'file*.txt' 패턴에 맞는 파일의 경로를 찾아줘.`;
  // console.log(`\n--- 열 번째 쿼리: glob (file*.txt 패턴) ---`);
  // try {
  //   const finalAnswer10 = await processChatWithTools(userQuery10);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // --- 새로운 사용자 쿼리 예시: 파일 내용 검색 ---
  // let userQuery7 = `'${testSearchFilePath}' 디렉토리에서 'World'라는 단어가 포함된 파일을 찾아줘.`;
  // console.log(`\n--- 일곱 번째 쿼리: 파일 내용 검색 (World) ---`);
  // try {
  //   const finalAnswer7 = await processChatWithTools(userQuery7);
  //   // console.log("\n--- 최종 사용자에게 보여줄 응답 ---");
  //   // console.log(finalAnswer7);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }
  // let userQuery8 = `'${testSearchFilePath}' 디렉토리에서 '.js' 파일 중 'function'이라는 단어가 포함된 파일을 찾아줘.`;
  // console.log(`\n--- 여덟 번째 쿼리: 파일 내용 검색 (function in .js) ---`);
  // try {
  //   const finalAnswer8 = await processChatWithTools(userQuery8);
  //   console.log("\n--- 최종 사용자에게 보여줄 응답 ---");
  //   console.log(finalAnswer8);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // 파일쓰기는 위험하므로 현재로서는 사용하지 않음
  // --- 새로운 사용자 쿼리 예시: 파일 쓰기 ---
  // const newFilePath = path.join(process.cwd(), "new_file_by_llm.txt");
  // const fileContent = "이것은 LLM이 작성한 새로운 파일입니다. 안녕하세요!";
  // let userQuery3 = `'${newFilePath}' 파일에 '${fileContent}' 내용을 써줘.`;
  // console.log(`\n--- 파일 쓰기 ---`);
  // try {
  //   const finalAnswer3 = await processChatWithTools(userQuery3);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // 현재 경로 조회 (성공)
  // const currentDir = process.cwd();
  // let userQuery1 = `'${currentDir}' 디렉토리의 파일 목록을 보여줘.`;
  // console.log(`\n--- 첫 번째 쿼리: 디렉토리 목록 조회 ---`);
  // try {
  //   const finalAnswer1 = await processChatWithTools(userQuery1);
  // } catch (e) {
  //   console.error(`\n오류 발생: ${e.message}`);
  // }

  // 파일 읽기 (성공)
  // const userQuery = `'${testFilePath}' 파일의 내용을 읽고 원문과 한국어로 각각 답변해줘`;
  // try {
  //   const finalAnswer = await processChatWithTools(userQuery);
  //   // console.log("\n--- ✅ 최종 응답 ---");
  //   // console.log(finalAnswer);
  // } catch (e) {
  //   console.error(`\n--- ❌ 오류 발생 ---`);
  //   console.error(`오류 메시지: ${e.message}`);
  //   console.error(
  //     "Ollama 서버가 실행 중인지, 모델이 정상적으로 다운로드되었는지 확인하세요."
  //   );
  //   console.error(`(실행 명령어 예시: ollama run ${MODEL_NAME})`);
  // }
}

main();
