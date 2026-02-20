import { createFactory } from "react";
import ReactDOM from "react-dom";

// createFactory suppressed by config rule
const factory = createFactory("div");

// findDOMNode is NOT suppressed — should still produce a finding
class MyComponent extends React.Component {
  componentDidMount() {
    const node = ReactDOM.findDOMNode(this);
    console.log(node);
  }

  render() {
    return factory({ className: "test" });
  }
}

export { factory, MyComponent };
