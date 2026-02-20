import { createFactory } from "react";
import ReactDOM from "react-dom";

// doxy-ignore deprecated-api -- Intentionally using deprecated API for legacy compat
const factory = createFactory("div");

class MyComponent extends React.Component {
  componentDidMount() {
    // This one is NOT suppressed — should still produce a finding
    const node = ReactDOM.findDOMNode(this);
    console.log(node);
  }

  render() {
    return factory({ className: "test" });
  }
}

export { factory, MyComponent };
