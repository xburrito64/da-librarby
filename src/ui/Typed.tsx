// Text that types itself out, letter by letter, in themes that ask for it (and while their
// "typing" option is on). Only the first time a text is seen; a click finishes it at once.
// The rest of the text is already there, invisibly, so nothing jumps around while it types.
// In a box that only shows a few lines, typing stops at the bottom of the box (class "is-typing"
// lets the box hide its "..." meanwhile).
import { Fragment, useEffect, useRef, useState, type ElementType } from "react";
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

/** Later lines that start with "* " get the mark too. */
function withMarks(s: string) {
  return s.split("\n" + MARK).map((part, i) =>
    i === 0 ? (
      part
    ) : (
      <Fragment key={i}>
        {"\n"}
        <span className="typed__mark">*</span> {part}
      </Fragment>
    ),
  );
}

export default function Typed({ text: full, as: Tag = "span", className, title, onClick }: Props) {
  const marked = full.startsWith(MARK);
  const text = marked ? full.slice(MARK.length) : full;
  const theme = useThemeInfo();
  const option = useThemeOption("typing");
  const on = !!theme?.extras?.typing && option !== false;
  const [shown, setShown] = useState(() => (on && !typedBefore.has(text) ? 0 : text.length));
  const box = useRef<HTMLElement>(null);
  const caret = useRef<HTMLSpanElement>(null);

  const finish = () => {
    typedBefore.add(text);
    setShown(text.length);
  };

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
    if (shown <= 0 || shown >= text.length) return;
    // Reached a line the box doesn't show: the rest is cut off anyway.
    const bottom = box.current?.getBoundingClientRect().bottom;
    const at = caret.current?.getBoundingClientRect().top;
    if (bottom != null && at != null && at >= bottom - 1) {
      finish();
      return;
    }
    if (shown % BLIP_EVERY === 0 && text[shown] !== " ") playSound("text");
  }, [shown, text]);

  const typing = shown < text.length;
  return (
    <Tag
      ref={box}
      className={[className, typing && "is-typing"].filter(Boolean).join(" ") || undefined}
      title={title}
      onClick={(e: React.MouseEvent) => {
        if (typing) {
          // The first click only finishes the text.
          e.stopPropagation();
          finish();
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
          {withMarks(text.slice(0, shown))}
          <span ref={caret} />
          <span className="typed__rest" aria-hidden="true">
            {withMarks(text.slice(shown))}
          </span>
        </>
      ) : (
        withMarks(text)
      )}
    </Tag>
  );
}
