import React from "react";
import { createFactory } from "react";
import ReactDOM from "react-dom";

// createFactory was deprecated in React 16.13.0
const factory = createFactory("div");

// findDOMNode was deprecated in React 16.6.0
class MyComponent extends React.Component {
  componentDidMount() {
    const node = ReactDOM.findDOMNode(this);
    console.log(node);
  }

  render() {
    return <div>Hello</div>;
  }
}

export { factory, MyComponent };
