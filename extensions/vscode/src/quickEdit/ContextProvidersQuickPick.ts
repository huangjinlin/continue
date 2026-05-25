import { fetchwithRequestOptions } from "@continuedev/fetch";
import { ContinueConfig, IDE } from "core";
import { QuickPickItem, window } from "vscode";

import { localize } from "../util/localization";

export async function getContextProviderItems({
  contextProviders,
}: ContinueConfig): Promise<QuickPickItem[]> {
  if (!contextProviders) {
    return [];
  }

  const quickPickItems = contextProviders
    .filter((provider) => provider.description.type === "normal")
    .map((provider) => {
      return {
        label: provider.description.displayTitle,
        detail: provider.description.description,
      };
    });

  return quickPickItems;
}

export async function getContextProvidersString(
  selectedProviders: QuickPickItem[] | undefined,
  config: ContinueConfig,
  ide: IDE,
): Promise<string> {
  const contextItems = (
    await Promise.all(
      selectedProviders?.map((selectedProvider) => {
        const provider = config.contextProviders?.find(
          (provider) =>
            provider.description.displayTitle === selectedProvider.label,
        );

        if (!provider || !config.selectedModelByRole.chat) {
          return [];
        }

        return provider.getContextItems("", {
          config,
          ide,
          embeddingsProvider: config.selectedModelByRole.embed,
          reranker: config.selectedModelByRole.rerank,
          llm: config.selectedModelByRole.chat,
          fullInput: "",
          selectedCode: [],
          fetch: (url, init) =>
            fetchwithRequestOptions(url, init, config.requestOptions),
          isInAgentMode: false,
        });
      }) || [],
    )
  ).flat();

  return contextItems.map((item) => item.content).join("\n\n") + "\n\n---\n\n";
}

export async function getContextProviderQuickPickVal(
  config: ContinueConfig,
  ide: IDE,
) {
  const contextProviderItems = await getContextProviderItems(config);

  const quickPick = window.createQuickPick();

  quickPick.items = contextProviderItems;
  quickPick.title = localize("Context providers", "上下文提供器");
  quickPick.placeholder = localize(
    "Select a context provider to add to your prompt",
    "选择一个上下文提供器加入你的提示词",
  );
  quickPick.canSelectMany = true;

  quickPick.show();

  const val = await new Promise<string>((resolve) => {
    quickPick.onDidAccept(async () => {
      const selectedItems = Array.from(quickPick.selectedItems);
      getContextProvidersString(selectedItems, config, ide)
        .then(resolve)
        .catch((e) => {
          console.warn(`Fail to get context providers: ${e}`);
          resolve("");
        });
    });
  });

  quickPick.dispose();

  return val;
}
