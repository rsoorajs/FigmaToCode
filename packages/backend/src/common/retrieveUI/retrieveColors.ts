import { rgbTo6hex } from "../color";
import {
  swiftuiColor,
  swiftuiGradient,
} from "../../swiftui/builderImpl/swiftuiColor";
import {
  tailwindColor,
  tailwindGradient,
} from "../../tailwind/builderImpl/tailwindColor";
import {
  flutterColor,
  flutterGradient,
} from "../../flutter/builderImpl/flutterColor";
import {
  htmlColor,
  htmlGradientFromFills,
} from "../../html/builderImpl/htmlColor";
import { calculateContrastRatio } from "./commonUI";
import {
  LinearGradientConversion,
  SolidColorConversion,
  Framework,
} from "types";

export const retrieveGenericSolidUIColors = (
  framework: Framework,
): Array<SolidColorConversion> => {
  const selectionColors = figma.getSelectionColors();
  if (!selectionColors || selectionColors.paints.length === 0) return [];

  const colors: Array<SolidColorConversion> = [];
  selectionColors.paints.forEach((paint) => {
    const fill = convertSolidColor(paint, framework);
    if (fill) {
      const exists = colors.find((col) => col.exportValue === fill.exportValue);
      if (!exists) {
        colors.push(fill);
      }
    }
  });

  return colors.sort((a, b) => a.hex.localeCompare(b.hex));
};

const convertSolidColor = (
  fill: Paint,
  framework: Framework,
): SolidColorConversion | null => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 1, g: 1, b: 1 };

  if (fill.type !== "SOLID") return null;

  const opacity = fill.opacity ?? 1.0;
  const output = {
    hex: rgbTo6hex(fill.color).toUpperCase(),
    colorName: "",
    exportValue: "",
    contrastBlack: calculateContrastRatio(fill.color, black),
    contrastWhite: calculateContrastRatio(fill.color, white),
  };

  if (framework === "Flutter") {
    output.exportValue = flutterColor(fill.color, opacity);
  } else if (framework === "HTML") {
    output.exportValue = htmlColor(fill.color, opacity);
  } else if (framework === "Tailwind") {
    Object.assign(output, tailwindColor(fill));
  } else if (framework === "SwiftUI") {
    output.exportValue = swiftuiColor(fill.color, opacity);
  }

  return output;
};

export const retrieveGenericLinearGradients = (
  framework: Framework,
): Array<LinearGradientConversion> => {
  const selectionColors = figma.getSelectionColors();
  const colorStr: Array<LinearGradientConversion> = [];

  console.log("selectionColors", selectionColors);

  selectionColors?.paints.forEach((paint) => {
    if (paint.type === "GRADIENT_LINEAR") {
      let fill = { ...paint };
      const t = fill.gradientTransform;
      fill.gradientHandlePositions = [
        { x: t[0][2], y: t[1][2] }, // Start: (e, f)
        { x: t[0][0] + t[0][2], y: t[1][0] + t[1][2] }, // End: (a + e, b + f)
      ];
      console.log("fill is", { ...fill });

      let exportValue = "";
      switch (framework) {
        case "Flutter":
          exportValue = flutterGradient(fill);
          break;
        case "HTML":
          exportValue = htmlGradientFromFills(fill);
          break;
        case "Tailwind":
          exportValue = tailwindGradient(fill);
          break;
        case "SwiftUI":
          exportValue = swiftuiGradient(fill);
          break;
      }
      colorStr.push({
        cssPreview: htmlGradientFromFills(fill),
        exportValue,
      });
    }
  });

  return colorStr;
};
