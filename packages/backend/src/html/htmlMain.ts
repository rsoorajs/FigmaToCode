import { formatWithJSX } from "../common/parseJSX";
import { indentString } from "../common/indentString";
import { retrieveTopFill } from "../common/retrieveFill";
import { HtmlTextBuilder } from "./htmlTextBuilder";
import { HtmlDefaultBuilder } from "./htmlDefaultBuilder";
import { PluginSettings } from "../code";
import { htmlAutoLayoutProps } from "./builderImpl/htmlAutoLayout";

let showLayerName = false;

const selfClosingTags = ["img"];

export let isPreviewGlobal = false;

let localSettings: PluginSettings;

export const htmlMain = (
  sceneNode: Array<SceneNode>,
  settings: PluginSettings,
  isPreview: boolean = false
): string => {
  showLayerName = settings.layerName;
  isPreviewGlobal = isPreview;
  localSettings = settings;

  let result = htmlWidgetGenerator(sceneNode, settings.jsx);

  // remove the initial \n that is made in Container.
  if (result.length > 0 && result.startsWith("\n")) {
    result = result.slice(1, result.length);
  }

  return result;
};

// todo lint idea: replace BorderRadius.only(topleft: 8, topRight: 8) with BorderRadius.horizontal(8)
const htmlWidgetGenerator = (
  sceneNode: ReadonlyArray<SceneNode>,
  isJsx: boolean
): string => {
  let comp = "";
  // filter non visible nodes. This is necessary at this step because conversion already happened.
  const visibleSceneNode = sceneNode.filter((d) => d.visible);
  visibleSceneNode.forEach((node, index) => {
    // if (node.isAsset || ("isMask" in node && node.isMask === true)) {
    //   comp += htmlAsset(node, isJsx);
    // } else
    if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
      comp += htmlContainer(node, "", [], isJsx);
    } else if (node.type === "GROUP") {
      comp += htmlGroup(node, isJsx);
    } else if (node.type === "FRAME") {
      comp += htmlFrame(node, isJsx);
    } else if (node.type === "TEXT") {
      comp += htmlText(node, isJsx);
    } else if (node.type === "LINE") {
      comp += htmlLine(node, isJsx);
    } else if (node.type === "VECTOR") {
      comp += htmlAsset(node, isJsx);
    }
  });

  return comp;
};

const htmlGroup = (node: GroupNode, isJsx: boolean = false): string => {
  // ignore the view when size is zero or less
  // while technically it shouldn't get less than 0, due to rounding errors,
  // it can get to values like: -0.000004196293048153166
  // also ignore if there are no children inside, which makes no sense
  if (node.width <= 0 || node.height <= 0 || node.children.length === 0) {
    return "";
  }

  // const vectorIfExists = tailwindVector(node, isJsx);
  // if (vectorIfExists) return vectorIfExists;

  // this needs to be called after CustomNode because widthHeight depends on it
  const builder = new HtmlDefaultBuilder(
    node,
    showLayerName,
    isJsx
  ).commonPositionStyles(node, localSettings.optimizeLayout);

  if (builder.styles) {
    const attr = builder.build([formatWithJSX("position", isJsx, "relative")]);

    const generator = htmlWidgetGenerator(node.children, isJsx);

    return `\n<div${attr}>${indentString(generator)}\n</div>`;
  }

  return htmlWidgetGenerator(node.children, isJsx);
};

// this was split from htmlText to help the UI part, where the style is needed (without <p></p>).
export const htmlText = (node: TextNode, isJsx: boolean): string => {
  let layoutBuilder = new HtmlTextBuilder(node, showLayerName, isJsx)
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .textAlign(node)
    .textTransform(node);

  const styledHtml = layoutBuilder.getTextSegments(node.id);

  let content = "";
  if (styledHtml.length === 1) {
    layoutBuilder.addStyles(styledHtml[0].style);
    content = styledHtml[0].text;
  } else {
    content = styledHtml
      .map((style) => `<span style="${style.style}">${style.text}</span>`)
      .join("");
  }

  return `\n<div${layoutBuilder.build()}>${content}</div>`;
};

const htmlFrame = (node: FrameNode, isJsx: boolean = false): string => {
  const childrenStr = htmlWidgetGenerator(node.children, isJsx);

  if (node.layoutMode !== "NONE") {
    const rowColumn = htmlAutoLayoutProps(node, node, isJsx);
    return htmlContainer(node, childrenStr, rowColumn, isJsx);
  } else {
    if (localSettings.optimizeLayout && node.inferredAutoLayout !== null) {
      const rowColumn = htmlAutoLayoutProps(
        node,
        node.inferredAutoLayout,
        isJsx
      );
      return htmlContainer(node, childrenStr, rowColumn, isJsx);
    }

    // node.layoutMode === "NONE" && node.children.length > 1
    // children needs to be absolute
    return htmlContainer(
      node,
      childrenStr,
      [formatWithJSX("position", isJsx, "relative")],
      isJsx
    );
  }
};

export const htmlAsset = (node: SceneNode, isJsx: boolean = false): string => {
  if (!("opacity" in node) || !("layoutAlign" in node) || !("fills" in node)) {
    return "";
  }

  const builder = new HtmlDefaultBuilder(node, showLayerName, isJsx)
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .commonShapeStyles(node, localSettings);

  let tag = "div";
  let src = "";
  if (retrieveTopFill(node.fills)?.type === "IMAGE") {
    tag = "img";
    src = ` src="https://via.placeholder.com/${node.width}x${node.height}"`;
  }

  return `\n<${tag}${builder.build()}${src} />`;
};

// properties named propSomething always take care of ","
// sometimes a property might not exist, so it doesn't add ","
export const htmlContainer = (
  node: FrameNode | RectangleNode | EllipseNode,
  children: string,
  additionalStyles: string[] = [],
  isJsx: boolean
): string => {
  // ignore the view when size is zero or less
  // while technically it shouldn't get less than 0, due to rounding errors,
  // it can get to values like: -0.000004196293048153166
  if (node.width <= 0 || node.height <= 0) {
    return children;
  }

  const builder = new HtmlDefaultBuilder(node, showLayerName, isJsx)
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .commonShapeStyles(node);

  if (builder.styles || additionalStyles) {
    const build = builder.build(additionalStyles);

    let tag = "div";
    let src = "";
    if (retrieveTopFill(node.fills)?.type === "IMAGE") {
      tag = "img";
      src = ` src="https://via.placeholder.com/${node.width}x${node.height}"`;
    }

    if (children) {
      return `\n<${tag}${build}${src}>${indentString(children)}\n</${tag}>`;
    } else if (selfClosingTags.includes(tag) || isJsx) {
      return `\n<${tag}${build}${src} />`;
    } else {
      return `\n<${tag}${build}${src}></${tag}>`;
    }
  }

  return children;
};

export const htmlLine = (node: LineNode, isJsx: boolean): string => {
  const builder = new HtmlDefaultBuilder(node, showLayerName, isJsx)
    .commonPositionStyles(node, localSettings.optimizeLayout)
    .commonShapeStyles(node);

  return `\n<div${builder.build()}></div>`;
};