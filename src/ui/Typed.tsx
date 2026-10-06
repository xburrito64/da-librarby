// Text that types itself out, letter by letter, in themes that ask for it (and while their
// "typing" option is on). Only the first time a text is seen; a click finishes it at once.
// The rest of the text is already there, invisibly, so nothing jumps around while it types.
import { useEffect, useState, type ElementType } from "react";
import { useThemeInfo } from "../theme/theme";
import { useThemeOption } from "../theme/options";
import { playSound } from "../theme/sound";

const LETTER_MS = 22;
/** A typing blip every few letters. */
const BLIP_EVERY = 3;

const typedBefore = new Set<string>();

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/** Lines starting with "* " (as in the game's text boxes) get a separate mark a theme can draw. */
const MARK = "* ";

export default function Typed({ text: full, as: Tag = "span", className, title, onClick }: Props) {
  const marked = full.startsWith(MARK);
  const text = marked ? full.slice(MARK.length) : full;
  const theme = useThemeInfo();
  const option = useThemeOption("typing");
  const on = !!theme?.extras?.typing && option !== false;
  const [shown, setShown] = useState(() => (on && !typedBefore.has(text) ? 0 : text.length));

  useEffect(() => {
    if (!on || typedBefore.has(text) || reducedMotion()) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= text.length) {
          window.clearInterval(timer);
          typedBefore.add(text);
        }
        return n + 1;
      });
    }, LETTER_MS);
    return () => window.clearInterval(timer);
  }, [text, on]);

  useEffect(() => {
    if (shown > 0 && shown < text.length && shown % BLIP_EVERY === 0 && text[shown] !== " ") playSound("text");
  }, [shown, text]);

  const typing = shown < text.length;
  return (
    <Tag
      className={className}
      title={title}
      onClick={() => {
        if (typing) {
          typedBefore.add(text);
          setShown(text.length);
        } else onClick?.();
      }}
    >
      {marked && (
        <>
          <span className="typed__mark">*</span>{" "}
        </>
      )}
      {typing ? (
        <>
          {text.slice(0, shown)}
          <span className="typed__rest" aria-hidden="true">
            {text.slice(shown)}
          </span>
        </>
      ) : (
        text
      )}
    </Tag>
  );
}
