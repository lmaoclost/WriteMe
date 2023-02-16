import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Value as QuillProps } from "react-quill";
import { convertDeltaToHtml } from "../../utils/convertDeltaToHtml";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";

export default function RichTextField() {
  const [value, setValue] = useState<QuillProps>();

  useEffect(() => {
    const textValue = localStorage.getItem("text") || "{}";
    const { ops } = JSON.parse(textValue);
    const convertedValue = convertDeltaToHtml(ops);
    setValue(convertedValue);
  }, []);

  const handleValueChange = (
    content: string,
    delta: any,
    source: any,
    editor: any
  ) => {
    const editorContent = editor.getContents();

    localStorage.setItem("text", JSON.stringify(editorContent));
    const convertedValue = convertDeltaToHtml(editorContent.ops);
    setValue(convertedValue);
  };

  return (
    <>
      <ReactQuill theme="snow" value={value} onChange={handleValueChange} />
    </>
  );
}
