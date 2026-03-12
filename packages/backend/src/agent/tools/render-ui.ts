export interface ComponentNode {
  type: string;
  id?: string;
  action?: string;
  children?: ComponentNode[];
  [key: string]: unknown;
}

export interface RenderUIInput {
  surfaceId: string;
  layout: ComponentNode;
}

// Flatten a nested component tree into A2UI-style adjacency list
interface FlatNode {
  nodeId: string;
  type: string;
  parentId: string | null;
  props: Record<string, unknown>;
}

let counter = 0;
function nextId(): string {
  return `n${++counter}`;
}

function flattenTree(
  node: ComponentNode,
  parentId: string | null = null
): FlatNode[] {
  const nodeId = node.id || nextId();
  const { type, id, children, action, ...rest } = node;

  const flat: FlatNode = {
    nodeId,
    type,
    parentId,
    props: { ...rest, ...(action ? { action } : {}) },
  };

  const result: FlatNode[] = [flat];
  if (children) {
    for (const child of children) {
      result.push(...flattenTree(child, nodeId));
    }
  }
  return result;
}

export function processRenderUI(input: RenderUIInput) {
  counter = 0;
  const flatNodes = flattenTree(input.layout);
  return {
    surfaceId: input.surfaceId,
    componentTree: input.layout, // The nested tree for the frontend's recursive renderer
    nodes: flatNodes, // Flat adjacency list (A2UI format)
  };
}
