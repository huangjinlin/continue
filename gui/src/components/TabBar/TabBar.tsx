import {
  CheckIcon,
  ChevronDownIcon,
  QueueListIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius } from "..";
import { newSession } from "../../redux/slices/sessionSlice";
import {
  addTab,
  handleSessionChange,
  removeTab,
  setActiveTab,
  setTabs,
} from "../../redux/slices/tabsSlice";
import { AppDispatch, RootState } from "../../redux/store";
import { loadSession, saveCurrentSession } from "../../redux/thunks/session";
import { varWithFallback } from "../../styles/theme";
import { ToolTip } from "../gui/Tooltip";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

// Haven't set up theme colors for tabs yet
// Will keep it simple and choose from existing ones. Comments show vars we could use
const tabBorderVar = varWithFallback("border"); // --vscode-tab-border
const tabBackgroundVar = varWithFallback("background"); // --vscode-tab-inactiveBackground
const tabForegroundVar = varWithFallback("foreground"); // --vscode-tab-inactiveForeground
const tabHoverBackgroundVar = varWithFallback("list-hover"); // --vscode-tab-hoverBackground
const tabHoverForegroundVar = varWithFallback("foreground"); // --vscode-tab-hoverForeground
const tabSelectedBackgroundVar = varWithFallback("background"); // --vscode-tab-activeBackground
const tabSelectedForegroundVar = varWithFallback("foreground"); // --vscode-tab-activeForeground
const tabAccentVar = varWithFallback("accent"); // --vscode-tab-activeBorderTop

const TabBarWrapper = styled.div`
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  flex-grow: 0;
  min-width: 0;
  background-color: ${tabBackgroundVar};
  border-bottom: none;
  position: relative;
  margin-top: 2px;
`;

const TabBarContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  flex: 1 1 auto;
  align-items: stretch;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabBarControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 0 6px;
  border-bottom: 1px solid ${tabBorderVar};
  border-left: 1px solid ${tabBorderVar};
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${tabBackgroundVar} 70%, transparent),
    ${tabBackgroundVar} 35%
  );
`;

const SessionMenuButton = styled(ListboxButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 24px;
  height: 20px;
  border: 1px solid ${tabBorderVar};
  border-radius: ${defaultBorderRadius};
  background-color: transparent;
  color: ${tabForegroundVar};
  padding: 0 4px;
  transition:
    background-color 0.2s,
    color 0.2s,
    opacity 0.2s;

  &:hover {
    background-color: ${tabHoverBackgroundVar};
    color: ${tabHoverForegroundVar};
  }
`;

const SessionMenuOptions = styled(ListboxOptions)`
  min-width: 220px;
  max-width: 320px;
  max-height: 240px;
  padding: 4px 0;
`;

const SessionMenuOptionRow = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  font-weight: ${(props) => (props.isActive ? 600 : 400)};
`;

const SessionMenuTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SessionMenuActiveIcon = styled(CheckIcon)`
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
`;

const Tab = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 5px 0 12px;
  flex: 0 0 140px;
  min-width: 120px;
  max-width: 180px;
  height: 25px;
  background-color: ${(props) =>
    props.isActive ? tabSelectedBackgroundVar : tabBackgroundVar};
  color: ${(props) =>
    props.isActive ? tabSelectedForegroundVar : tabForegroundVar};
  cursor: pointer;
  border: 1px solid ${tabBorderVar};
  border-bottom: ${(props) =>
    props.isActive ? "none" : `1px solid ${tabBorderVar}`};
  user-select: none;
  position: relative;
  transition: background-color 0.2s;
  border-top: ${(props) =>
    props.isActive ? `1px solid ${tabAccentVar}` : `1px solid ${tabBorderVar}`};
  &:first-child {
    border-left: none;
  }
  & + & {
    border-left: none;
  }

  &:hover {
    background-color: ${(props) =>
      props.isActive ? tabSelectedBackgroundVar : tabHoverBackgroundVar};
    color: ${(props) =>
      props.isActive ? tabSelectedForegroundVar : tabHoverForegroundVar};
  }
`;

const TabTitle = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: ${defaultBorderRadius};
  padding: 2px;
  visibility: hidden;

  &:hover {
    opacity: 1;
    background-color: ${tabHoverBackgroundVar};
  }

  ${Tab}:hover & {
    visibility: visible;
  }

  &[disabled] {
    display: none !important;
  }
`;

const TabBarSpace = styled.div`
  flex: 0 0 16px;
  display: flex;
  border-bottom: 1px solid ${tabBorderVar};
  background-color: ${tabBackgroundVar};
`;

export const TabBar = React.forwardRef<HTMLDivElement>((_, ref) => {
  const dispatch = useDispatch<AppDispatch>();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const currentSessionId = useSelector((state: RootState) => state.session.id);
  const currentSessionTitle = useSelector(
    (state: RootState) => state.session.title,
  );
  const hasHistory = useSelector(
    (state: RootState) => state.session.history.length > 0,
  );
  const tabs = useSelector((state: RootState) => state.tabs.tabs);
  const activeTabId = tabs.find((tab) => tab.isActive)?.id ?? tabs[0]?.id ?? "";

  // Simple UUID generator for our needs
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  const setScrollContainerNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;

      if (!ref) {
        return;
      }

      if (typeof ref === "function") {
        ref(node);
        return;
      }

      ref.current = node;
    },
    [ref],
  );

  const scrollTabIntoView = useCallback((id: string) => {
    const target = tabNodeRefs.current[id];
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;

    dispatch(
      handleSessionChange({
        currentSessionId,
        currentSessionTitle,
        newTabId: generateId(), // Pass the ID generator result
      }),
    );
  }, [currentSessionId, currentSessionTitle]);

  const handleNewTab = async () => {
    // Save current session before creating new one
    if (hasHistory) {
      await dispatch(
        saveCurrentSession({ openNewSession: false, generateTitle: true }),
      );
    }

    dispatch(newSession());

    dispatch(
      addTab({
        id: generateId(),
        title: `Chat ${tabs.length + 1}`,
        isActive: true,
        sessionId: undefined,
      }),
    );
  };

  useEffect(() => {
    if (!tabs.length) {
      handleNewTab();
    }
  }, [tabs.map((t) => t.id).join(",")]);

  const handleTabClick = async (id: string) => {
    const targetTab = tabs.find((tab) => tab.id === id);
    if (!targetTab) return;

    if (targetTab.sessionId) {
      // Switch to existing session
      await dispatch(
        loadSession({
          sessionId: targetTab.sessionId,
          saveCurrentSession: hasHistory,
        }),
      );
    }

    dispatch(setActiveTab(id));
    scrollTabIntoView(id);
  };

  const handleTabClose = async (id: string) => {
    //if (tabs.length <= 1) return;

    const isClosingActive = tabs.find((t) => t.id === id)?.isActive;
    const filtered = tabs.filter((t) => t.id !== id);

    if (isClosingActive) {
      const lastTab = filtered[filtered.length - 1];
      if (filtered.length) {
        await handleTabClick(lastTab.id);
        dispatch(
          setTabs(
            filtered.map((tab, i) => ({
              ...tab,
              isActive: i === filtered.length - 1,
            })),
          ),
        );
      } else {
        dispatch(setTabs([]));
        dispatch(newSession());
      }
    } else {
      dispatch(removeTab(id));
    }
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    const container = event.currentTarget;

    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    container.scrollLeft += event.deltaY;
  };

  return (
    <TabBarWrapper
      style={{
        display: tabs.length === 1 ? "none" : "flex",
      }}
    >
      <TabBarContainer ref={setScrollContainerNode} onWheel={handleWheel}>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            ref={(node) => {
              tabNodeRefs.current[tab.id] = node;
            }}
            isActive={tab.isActive}
            onClick={() => handleTabClick(tab.id)}
            onAuxClick={(e) => {
              // Middle mouse button
              if (e.button === 1) {
                e.preventDefault();
                handleTabClose(tab.id);
              }
            }}
          >
            <TabTitle>{tab.title}</TabTitle>
            <CloseButton
              /* disabled={tabs.length === 1} */
              onClick={(e) => {
                e.stopPropagation();
                handleTabClose(tab.id);
              }}
            >
              <XMarkIcon width={12} height={12} />
            </CloseButton>
          </Tab>
        ))}
        <TabBarSpace>
          {/* <NewTabButton onClick={handleNewTab}>
            <PlusIcon width={16} height={16} />
          </NewTabButton> */}
        </TabBarSpace>
      </TabBarContainer>
      {tabs.length > 1 && (
        <TabBarControls>
          <Listbox
            value={activeTabId}
            onChange={(id: string) => {
              void handleTabClick(id);
            }}
          >
            <div className="relative">
              <ToolTip content="All sessions">
                <SessionMenuButton aria-label="All sessions">
                  <QueueListIcon width={12} height={12} />
                  <ChevronDownIcon width={10} height={10} />
                </SessionMenuButton>
              </ToolTip>
              <SessionMenuOptions anchor="bottom end">
                {tabs.map((tab) => (
                  <ListboxOption key={tab.id} value={tab.id}>
                    <SessionMenuOptionRow isActive={tab.isActive}>
                      <SessionMenuTitle>{tab.title}</SessionMenuTitle>
                      {tab.isActive && <SessionMenuActiveIcon />}
                    </SessionMenuOptionRow>
                  </ListboxOption>
                ))}
              </SessionMenuOptions>
            </div>
          </Listbox>
        </TabBarControls>
      )}
    </TabBarWrapper>
  );
});
