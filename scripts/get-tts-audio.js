// curl -X POST http://127.0.0.1:7860/gradio_api/call/tts_interface -s -H "Content-Type: application/json" -d '{
// 	"data": [
// 							"请给我一杯咖啡？",

// 							"Chelsie / 千雪",

// 							"Chinese / 中文"

// 	]}'
import { existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const API_URL =
  process.env.TTS_API_URL ||
  "http://127.0.0.1:7860/gradio_api/call/tts_interface";

const sentenceId = process.argv[2] || "test_sentence";
const sentence = process.argv[3] || "请给我一杯咖啡。";
const sentenceSource = process.argv[4] || "tatoeba";
const voice = "Chelsie / 千雪";
const language = "Chinese / 中文";
const dataInput = [sentence, voice, language];

const getEventId = async () => {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: dataInput }),
  });

  const resJson = await res.json();
  console.log(resJson);
  // {"event_id":"a73aef49dcb14a32a66fb810e637795f"}
  return resJson.event_id;
};

const getAudioFilepath = async (eventId) => {
  const res = await fetch(`${API_URL}/${eventId}`, {
    method: "GET",
  });
  // res:
  // event: complete
  // data: [{"path": "/tmp/gradio/e681cfe6d05f630b8eb537c6451a203c1f82b2edc1cf4f0ff9e0e92646b14a74/audio.wav", "url": "http://127.0.0.1:7860/gradio_api/file=/tmp/gradio/e681cfe6d05f630b8eb537c6451a203c1f82b2edc1cf4f0ff9e0e92646b14a74/audio.wav", "size": null, "orig_name": "audio.wav", "mime_type": null, "is_stream": false, "meta": {"_type": "gradio.FileData"}}]
  const responseText = await res.text();
  const dataMatch = responseText.match(/data: (.+)/);
  if (!dataMatch) throw new Error("No data found in response");

  const data = JSON.parse(dataMatch[1]);
  return data[0].path;
};

const convertWavToOgg = (wavPath, oggPath) => {
  if (!existsSync(wavPath)) {
    throw new Error(`WAV file does not exist: ${wavPath}`);
  }
  execFileSync("ffmpeg", ["-i", wavPath, "-c:a", "libvorbis", "-y", oggPath]);
};
(async () => {
  try {
    const eventId = await getEventId();
    console.log(`Got event ID: ${eventId}`);

    const wavPath = await getAudioFilepath(eventId);
    console.log(`Got WAV file path: ${wavPath}`);

    console.log(`Copying from ${wavPath} to ./audio/${sentenceId}.wav`);
    const destWavPath = `misc/audio/sentences_${sentenceSource}_${sentenceId}.wav`;
    copyFileSync(wavPath, destWavPath);
    console.log(`Copied WAV file to: ${destWavPath}`);

    const oggPath = destWavPath.replace(".wav", ".ogg");
    convertWavToOgg(destWavPath, oggPath);
    console.log(`Converted to OGG file path: ${oggPath}`);
  } catch (err) {
    console.error("Error:", err);
  }
})();
