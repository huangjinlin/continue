import { Editor, JSONContent } from "@tiptap/react";
import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { CustomScrollbarDiv } from ".";
import { AuthProvider } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { LocalStorageProvider } from "../context/LocalStorage";
import TelemetryProviders from "../hooks/TelemetryProviders";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCodeToEdit } from "../redux/slices/editState";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { enterEdit, exitEdit } from "../redux/thunks/edit";
import { loadSession, saveCurrentSession } from "../redux/thunks/session";
import { fontSize, isMetaEquivalentKeyPressed } from "../util";
import { ROUTES } from "../util/navigation";
import { FatalErrorIndicator } from "./config/FatalErrorNotice";
import TextDialog from "./dialogs";
import { GenerateRuleDialog } from "./GenerateRuleDialog";
import { useMainEditor } from "./mainInput/TipTapEditor";
import {
  isNewUserOnboarding,
  OnboardingCard,
  useOnboardingCard,
} from "./OnboardingCard";
import OSRContextMenu from "./OSRContextMenu";
import PostHogPageView from "./PosthogPageView";

const LayoutTopDiv = styled(CustomScrollbarDiv)`
  height: 100%;
  position: relative;
  overflow-x: hidden;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow-x: visible;
`;

async function waitForMainEditor(
  mainEditorRef: React.MutableRefObject<Editor | null>,
  timeoutMs = 2000,
  intervalMs = 25,
): Promise<Editor | null> {
  const startedAt = Date.now();

  while (!mainEditorRef.current) {
    if (Date.now() - startedAt >= timeoutMs) {
      return null;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, intervalMs);
    });
  }

  return mainEditorRef.current;
}

function createPromptoEditorContent(input: string): JSONContent {
  const normalizedInput = input.replace(/\r\n/g, "\n");
  const lines = normalizedInput.split("\n");

  return {
    type: "doc",
    content: lines.map((line) => {
      if (!line.length) {
        return { type: "paragraph" };
      }

      return {
        type: "paragraph",
        content: [{ type: "text", text: line }],
      };
    }),
  };
}

const Layout = () => {
  const [showStagingIndicator, setShowStagingIndicator] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const onboardingCard = useOnboardingCard();
  const ideMessenger = useContext(IdeMessengerContext);

  const { mainEditor, onEnterRef } = useMainEditor();
  const mainEditorRef = useRef<Editor | null>(mainEditor);
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);

  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const currentSessionId = useAppSelector((state) => state.session.id);
  const isHome =
    location.pathname === ROUTES.HOME ||
    location.pathname === ROUTES.HOME_INDEX;

  useEffect(() => {
    mainEditorRef.current = mainEditor;
  }, [mainEditor]);

  useEffect(() => {
    (async () => {
      const response = await ideMessenger.request(
        "controlPlane/getEnvironment",
        undefined,
      );
      response.status === "success" &&
        setShowStagingIndicator(response.content.AUTH_TYPE.includes("staging"));
    })();
  }, []);

  useWebviewListener(
    "newSession",
    async () => {
      navigate(ROUTES.HOME);
      if (isInEdit) {
        await dispatch(exitEdit({}));
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isInEdit],
  );

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return false;
    },
    [isHome],
    isHome,
  );

  useWebviewListener(
    "focusContinueInputWithNewSession",
    async () => {
      navigate(ROUTES.HOME);
      if (isInEdit) {
        await dispatch(
          exitEdit({
            openNewSession: true,
          }),
        );
      } else {
        await dispatch(
          saveCurrentSession({
            openNewSession: true,
            generateTitle: true,
          }),
        );
      }
    },
    [isHome, isInEdit],
    isHome,
  );

  useWebviewListener(
    "promptoDeliverPrompt",
    async (data) => {
      navigate(ROUTES.HOME);

      if (isInEdit) {
        await dispatch(exitEdit({}));
      }

      if (data.sessionId && data.sessionId !== currentSessionId) {
        await dispatch(
          loadSession({
            sessionId: data.sessionId,
            saveCurrentSession: true,
          }),
        );
      }

      const editor = await waitForMainEditor(mainEditorRef);
      if (!editor) {
        throw new Error("Continue main input was not ready in time.");
      }

      editor.commands.setContent(createPromptoEditorContent(data.input));
      editor.commands.focus("end");

      if (data.submit !== false) {
        onEnterRef.current({ useCodebase: false, noContext: true });
      }
    },
    [currentSessionId, dispatch, isInEdit, navigate],
  );

  useWebviewListener(
    "addModel",
    async () => {
      navigate("/models");
    },
    [navigate],
  );

  useWebviewListener(
    "navigateTo",
    async (data) => {
      if (data.toggle && location.pathname === data.path) {
        navigate("/");
      } else {
        navigate(data.path);
      }
    },
    [location, navigate],
  );

  useWebviewListener(
    "setupLocalConfig",
    async () => {
      onboardingCard.open(OnboardingModes.LOCAL);
    },
    [],
  );

  useWebviewListener(
    "freeTrialExceeded",
    async () => {
      dispatch(setShowDialog(true));
      onboardingCard.setActiveTab(OnboardingModes.MODELS_ADD_ON);
      dispatch(
        setDialogMessage(
          <div className="flex-1">
            <OnboardingCard isDialog />
          </div>,
        ),
      );
    },
    [],
  );

  useWebviewListener(
    "setupApiKey",
    async () => {
      onboardingCard.open(OnboardingModes.API_KEY);
    },
    [],
  );

  useWebviewListener(
    "focusEdit",
    async () => {
      await ideMessenger.request("edit/addCurrentSelection", undefined);
      await dispatch(enterEdit({ editorContent: mainEditor?.getJSON() }));
      mainEditor?.commands.focus();
    },
    [ideMessenger, mainEditor],
  );

  useWebviewListener(
    "setCodeToEdit",
    async (payload) => {
      dispatch(
        setCodeToEdit({
          codeToEdit: payload,
        }),
      );
    },
    [],
  );

  useWebviewListener(
    "exitEditMode",
    async () => {
      await dispatch(exitEdit({}));
    },
    [],
  );

  useWebviewListener(
    "generateRule",
    async () => {
      dispatch(setShowDialog(true));
      dispatch(setDialogMessage(<GenerateRuleDialog />));
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (isMetaEquivalentKeyPressed(event) && event.code === "KeyC") {
        const selection = window.getSelection()?.toString();
        if (selection) {
          setTimeout(() => {
            void navigator.clipboard.writeText(selection);
          }, 100);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isNewUserOnboarding() && isHome) {
      onboardingCard.open();
    }
  }, [isHome]);

  return (
    <LocalStorageProvider>
      <AuthProvider>
        <TelemetryProviders>
          <LayoutTopDiv>
            {showStagingIndicator && (
              <span
                title="Staging environment"
                className="absolute right-0 mx-1.5 h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: "var(--vscode-list-warningForeground)",
                }}
              />
            )}
            <OSRContextMenu />
            <div
              style={{
                scrollbarGutter: "stable both-edges",
                minHeight: "100%",
                display: "grid",
                gridTemplateRows: "1fr auto",
              }}
            >
              <TextDialog
                showDialog={showDialog}
                onEnter={() => {
                  dispatch(setShowDialog(false));
                }}
                onClose={() => {
                  dispatch(setShowDialog(false));
                }}
                message={dialogMessage}
              />

              <GridDiv>
                <PostHogPageView />
                <Outlet />
                {/* The fatal error for chat is shown below input */}
                {!isHome && <FatalErrorIndicator />}
              </GridDiv>
            </div>
            <div style={{ fontSize: fontSize(-4) }} id="tooltip-portal-div" />
          </LayoutTopDiv>
        </TelemetryProviders>
      </AuthProvider>
    </LocalStorageProvider>
  );
};

export default Layout;
