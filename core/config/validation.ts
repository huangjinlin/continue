import { ConfigValidationError } from "@continuedev/config-yaml";

import { ModelDescription, SerializedContinueConfig } from "../";
import { modelSupportsImages } from "../llm/autodetect";
import { Telemetry } from "../util/posthog";

type VisualBridgeModelConfig = {
  title?: string;
  name?: string;
  provider?: string;
  model?: string;
  capabilities?: ModelDescription["capabilities"] | string[];
};

function getVisualBridgeModelTitle(model: VisualBridgeModelConfig): string {
  return model.title ?? model.name ?? model.model ?? "";
}

function getVisualBridgeModelCapabilities(
  capabilities: VisualBridgeModelConfig["capabilities"],
) {
  if (Array.isArray(capabilities)) {
    return {
      uploadImage: capabilities.includes("image_input"),
    };
  }

  return capabilities;
}

export function validateExperimentalConfig(config: {
  experimental?: unknown;
  models?: VisualBridgeModelConfig[];
}): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  if (config.experimental === undefined) {
    return errors;
  }

  if (
    typeof config.experimental !== "object" ||
    config.experimental === null ||
    Array.isArray(config.experimental)
  ) {
    errors.push({
      fatal: true,
      message: "The 'experimental' field should be an object if defined.",
    });
    return errors;
  }

  const visualBridge = (config.experimental as Record<string, unknown>)
    .visualBridge;

  if (visualBridge === undefined) {
    return errors;
  }

  if (
    typeof visualBridge !== "object" ||
    visualBridge === null ||
    Array.isArray(visualBridge)
  ) {
    errors.push({
      fatal: true,
      message:
        "The 'experimental.visualBridge' field should be an object if defined.",
    });
    return errors;
  }

  const { enabled, modelTitle, failOnBridgeError } = visualBridge as Record<
    string,
    unknown
  >;

  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push({
      fatal: true,
      message:
        "The 'experimental.visualBridge.enabled' field should be a boolean if defined.",
    });
  }

  if (
    modelTitle !== undefined &&
    (typeof modelTitle !== "string" || modelTitle.trim() === "")
  ) {
    errors.push({
      fatal: true,
      message:
        "The 'experimental.visualBridge.modelTitle' field should be a non-empty string if defined.",
    });
  }

  if (
    failOnBridgeError !== undefined &&
    typeof failOnBridgeError !== "boolean"
  ) {
    errors.push({
      fatal: true,
      message:
        "The 'experimental.visualBridge.failOnBridgeError' field should be a boolean if defined.",
    });
  }

  if (errors.some((error) => error.fatal)) {
    return errors;
  }

  if (enabled !== true) {
    return errors;
  }

  if (!modelTitle) {
    errors.push({
      fatal: true,
      message:
        "The 'experimental.visualBridge.modelTitle' field must be set when visual bridging is enabled.",
    });
    return errors;
  }

  const matchingModel = config.models?.find(
    (model) => getVisualBridgeModelTitle(model) === modelTitle,
  );

  if (!matchingModel) {
    errors.push({
      fatal: true,
      message: `The model \"${modelTitle}\" referenced by 'experimental.visualBridge.modelTitle' was not found in the configured models.`,
    });
    return errors;
  }

  if (
    !modelSupportsImages(
      matchingModel.provider ?? "",
      matchingModel.model ?? "",
      getVisualBridgeModelTitle(matchingModel),
      getVisualBridgeModelCapabilities(matchingModel.capabilities),
    )
  ) {
    errors.push({
      fatal: true,
      message: `The model \"${modelTitle}\" referenced by 'experimental.visualBridge.modelTitle' must support image input.`,
    });
  }

  return errors;
}

/**
 * Validates a SerializedContinueConfig object to ensure all properties are correctly formed.
 * @param config The configuration object to validate.
 * @returns An array of error messages if there are any. Otherwise, the config is valid.
 */
export function validateConfig(config: SerializedContinueConfig) {
  const errors: ConfigValidationError[] = [];

  // Validate chat models
  if (!Array.isArray(config.models)) {
    errors.push({
      fatal: true,
      message: "The 'models' field should be an array.",
    });
  } else {
    config.models.forEach((model, index) => {
      if (typeof model.title !== "string" || model.title.trim() === "") {
        errors.push({
          fatal: true,
          message: `Model at index ${index} has an invalid or missing 'title'.`,
        });
      }
      if (typeof model.provider !== "string") {
        errors.push({
          fatal: true,
          message: `Model at index ${index} has an invalid 'provider'.`,
        });
      }

      if (model.contextLength && model.completionOptions?.maxTokens) {
        const difference =
          model.contextLength - model.completionOptions.maxTokens;

        if (difference < 1000) {
          errors.push({
            fatal: false,
            message: `Model "${model.title}" has a contextLength of ${model.contextLength} and a maxTokens of ${model.completionOptions.maxTokens}. This leaves only ${difference} tokens for input context and will likely result in your inputs being truncated.`,
          });
        }
      }
    });
  }

  // Validate tab autocomplete model(s)
  if (config.tabAutocompleteModel) {
    function validateTabAutocompleteModel(modelDescription: ModelDescription) {
      const modelName = modelDescription.model.toLowerCase();
      const nonAutocompleteModels = [
        // "gpt",
        // "claude",
        "mistral",
        "instruct",
      ];

      if (
        nonAutocompleteModels.some((m) => modelName.includes(m)) &&
        !modelName.includes("deepseek") &&
        !modelName.includes("codestral") &&
        !modelName.toLowerCase().includes("coder")
      ) {
        errors.push({
          fatal: false,
          message: `${modelDescription.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://docs.continue.dev/features/tab-autocomplete#i-want-better-completions-should-i-use-gpt-4`,
        });
      }
    }

    if (Array.isArray(config.tabAutocompleteModel)) {
      config.tabAutocompleteModel.forEach(validateTabAutocompleteModel);
    } else {
      validateTabAutocompleteModel(config.tabAutocompleteModel);
    }
  }

  // Validate slashCommands
  if (config.slashCommands) {
    if (!Array.isArray(config.slashCommands)) {
      errors.push({
        fatal: true,
        message: "The 'slashCommands' field should be an array if defined.",
      });
    } else {
      config.slashCommands.forEach((command, index) => {
        if (typeof command.name !== "string" || command.name.trim() === "") {
          errors.push({
            fatal: true,
            message: `Slash command at index ${index} has an invalid or missing 'name'.`,
          });
        }
        if (typeof command.description !== "string") {
          errors.push({
            fatal: true,
            message: `Slash command at index ${index} has an invalid or missing 'description'.`,
          });
        }
      });
    }
  }

  // Validate contextProviders
  if (config.contextProviders) {
    if (!Array.isArray(config.contextProviders)) {
      errors.push({
        fatal: true,
        message: "The 'contextProviders' field should be an array if defined.",
      });
    } else {
      config.contextProviders.forEach((provider, index) => {
        if (typeof provider.name !== "string" || provider.name.trim() === "") {
          errors.push({
            fatal: true,
            message: `Context provider at index ${index} has an invalid or missing 'name'.`,
          });
        }
      });
    }
  }

  // Validate embeddingsProvider
  if (
    config.embeddingsProvider &&
    typeof config.embeddingsProvider !== "object"
  ) {
    errors.push({
      fatal: true,
      message: "The 'embeddingsProvider' field should be an object if defined.",
    });
  }

  // Validate reranker
  if (config.reranker && typeof config.reranker !== "object") {
    errors.push({
      fatal: true,
      message: "The 'reranker' field should be an object if defined.",
    });
  }

  errors.push(
    ...validateExperimentalConfig({
      experimental: config.experimental,
      models: Array.isArray(config.models) ? config.models : undefined,
    }),
  );

  // Validate other boolean flags
  const booleanFlags: Array<
    keyof Pick<
      SerializedContinueConfig,
      "allowAnonymousTelemetry" | "disableIndexing" | "disableSessionTitles"
    >
  > = ["allowAnonymousTelemetry", "disableIndexing", "disableSessionTitles"];

  booleanFlags.forEach((flag) => {
    if (config[flag] !== undefined && typeof config[flag] !== "boolean") {
      errors.push({
        fatal: true,
        message: `The '${flag}' field should be a boolean if defined.`,
      });
    }
  });

  if (errors.length > 0) {
    void Telemetry.capture(
      "configValidationError",
      {
        errors,
      },
      true,
    );

    return errors;
  }

  return undefined;
}
