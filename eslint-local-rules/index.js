const templateLocation = (context, node) =>
  node.sourceSpan
    ? context.sourceCode.parserServices.convertElementSourceSpanToLoc(node.sourceSpan)
    : { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };

const elementName = node => node?.name;
const attributes = node => node.attributes ?? [];
const hasAttribute = (node, name) => attributes(node).some(attribute => attribute.name === name);

const noNgModule = {
  meta: { type: 'problem', schema: [] },
  create: context => ({
    'Decorator[expression.callee.name="NgModule"]': node => context.report({ node, message: 'NgModule is forbidden. Use standalone APIs.' }),
  }),
};

const noNonStandaloneComponent = {
  meta: { type: 'problem', schema: [] },
  create: context => ({
    'Property[key.name="standalone"][value.value=false]': node => context.report({ node, message: 'Components must be standalone.' }),
  }),
};

const noButtonRouterLink = {
  meta: { type: 'problem', schema: [] },
  create: context => ({
    Element: node => {
      if (elementName(node) === 'button' && hasAttribute(node, 'routerLink')) {
        context.report({ loc: templateLocation(context, node), message: 'Links navigate and buttons act.' });
      }
    },
  }),
};

const iconHasAriaHidden = {
  meta: { type: 'problem', schema: [] },
  create: context => ({
    Element: node => {
      if (!['button', 'a'].includes(elementName(node))) return;
      for (const child of node.children ?? []) {
        if (elementName(child) === 'i' && !hasAttribute(child, 'aria-hidden')) {
          context.report({ loc: templateLocation(context, child), message: 'Icons inside interactive elements must be aria-hidden.' });
        }
      }
    },
  }),
};

const interactiveElementHasAriaLabel = {
  meta: { type: 'problem', schema: [] },
  create: () => ({}),
};

const unwrap = node => {
  while (node?.type === 'TSAsExpression' || node?.type === 'TSSatisfiesExpression' || node?.type === 'TSTypeAssertion') node = node.expression;
  return node;
};

const routeParamHasBreadcrumbLabel = {
  meta: { type: 'problem', schema: [] },
  create: context => ({
    ObjectExpression: node => {
      const properties = node.properties.filter(property => property.type === 'Property' && property.key.type === 'Identifier');
      const path = properties.find(property => property.key.name === 'path');
      const hasTarget = properties.some(property => ['component', 'loadComponent', 'loadChildren', 'children'].includes(property.key.name));
      if (!hasTarget || path?.value.type !== 'Literal' || typeof path.value.value !== 'string' || !path.value.value.includes(':')) return;
      const data = properties.find(property => property.key.name === 'data');
      const dataValue = unwrap(data?.value);
      const label = dataValue?.type === 'ObjectExpression' && dataValue.properties.find(property => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === 'breadcrumbLabel');
      const value = unwrap(label?.value);
      if (!label || (value?.type === 'Literal' && value.value !== false && !String(value.value).trim())) {
        context.report({ node, message: 'Parameterized routes need data.breadcrumbLabel.' });
      }
    },
  }),
};

module.exports = {
  rules: {
    'no-ng-module': noNgModule,
    'no-non-standalone-component': noNonStandaloneComponent,
    'no-button-router-link': noButtonRouterLink,
    'interactive-element-has-aria-label': interactiveElementHasAriaLabel,
    'icon-has-aria-hidden': iconHasAriaHidden,
    'route-param-has-breadcrumb-label': routeParamHasBreadcrumbLabel,
  },
};
