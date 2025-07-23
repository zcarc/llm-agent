import ollama from "ollama";
import { readFileJs, testFilePath } from "./tools.js"; // 1단계에서 만든 tools.ts/js 파일 임포트

// --- 1. Ollama의 도구 호출 형식에 맞는 도구 정의 ---
// Ollama는 OpenAI의 함수 호출과 유사한 JSON 스키마를 사용합니다.
const READ_FILE_TOOL_OLLAMA_SCHEMA = {
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
};

// --- 2. 도구 실행을 위한 맵핑 ---
// LLM이 호출을 지시할 함수 이름과 실제 JavaScript 함수를 연결합니다.
const availableFunctions = {
  read_file: readFileJs,
};

// --- 3. 대화 및 도구 호출 관리 함수 ---
async function chatWithOllamaAndTools(
  userQuery,
  modelName = "qwen2.5-coder:7b"
) {
  const messages = [];
  messages.push({ role: "user", content: userQuery });

  console.log(`\n[시스템] 사용자 쿼리: ${userQuery}`);

  // 1단계: 사용자 쿼리와 도구 정의를 LLM에 보냄
  let response = await ollama.chat({
    model: modelName,
    messages: messages,
    tools: [READ_FILE_TOOL_OLLAMA_SCHEMA], // 정의된 도구 스키마 전달
    stream: false, // 스트리밍 비활성화하여 전체 응답을 받음
  });

  // LLM의 첫 번째 응답 처리
  let assistantMessage = response.message;
  messages.push(assistantMessage); // LLM의 응답을 대화 기록에 추가

  console.log(`[LLM 응답] ${JSON.stringify(assistantMessage, null, 2)}`);

  // 2단계: LLM이 도구 호출을 지시했는지 확인
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    console.log("\n[시스템] LLM이 도구 호출을 지시했습니다.");
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = toolCall.function.arguments;

      if (availableFunctions[functionName]) {
        console.log(
          `[시스템] 도구 '${functionName}' 실행 중 (인자: ${JSON.stringify(
            functionArgs
          )})...`
        );
        // 3단계: 실제 도구 함수 실행
        const functionToCall = availableFunctions[functionName];
        const toolOutput = functionToCall(functionArgs.absolute_path); // 인자 전달
        console.log(
          `[시스템] 도구 실행 결과 (일부): ${toolOutput.substring(0, 200)}...`
        );

        // 4단계: 도구 실행 결과를 다시 LLM에 보냄
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id, // LLM이 제공한 tool_call_id 사용
          name: functionName,
          content: toolOutput,
        });

        console.log(
          "\n[시스템] 도구 실행 결과를 LLM에 다시 전송하여 최종 응답 요청."
        );
        const finalResponse = await ollama.chat({
          model: modelName,
          messages: messages,
          stream: false,
        });
        const finalAssistantMessage = finalResponse.message;
        messages.push(finalAssistantMessage); // 최종 응답을 대화 기록에 추가
        return finalAssistantMessage.content;
      } else {
        return `오류: 알 수 없는 도구 호출: ${functionName}`;
      }
    }
  } else {
    // LLM이 도구 호출 없이 직접 응답을 준 경우
    return assistantMessage.content;
  }
  return "처리 완료."; // 모든 도구 호출이 처리되었지만 최종 응답이 없는 경우
}

// --- 실행 예시 ---
async function run() {
  console.log(`테스트할 파일 경로: ${testFilePath}`);

  // LLM에게 파일 내용을 읽도록 지시하는 쿼리
  const userQuery = `'${testFilePath}' 파일의 내용을 읽어서 나에게 알려줘.`;

  try {
    const finalAnswer = await chatWithOllamaAndTools(userQuery);
    console.log("\n--- 최종 사용자에게 보여줄 응답 ---");
    console.log(finalAnswer);
  } catch (e) {
    console.error(`\n오류 발생: ${e.message}`);
    console.error(
      "Ollama 서버가 실행 중인지, 모델이 다운로드되어 있는지 확인하세요."
    );
  }
}

run();
