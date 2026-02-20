import React from "react";
import { createFactory } from "react";
import ReactDOM from "react-dom";

// createFactory was removed in React 19
const factory = createFactory("div");

// findDOMNode was removed in React 19
class MyComponent extends React.Component {
  componentDidMount() {
    const node = ReactDOM.findDOMNode(this);
    console.log(node);
  }

  render() {
    return <div>Hello</div>;
  }
}

// PropTypes was removed in React 19
const pt = React.PropTypes;

export { factory, MyComponent, pt };
