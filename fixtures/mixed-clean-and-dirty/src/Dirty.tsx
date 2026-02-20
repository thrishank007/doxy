import { createFactory } from "react";
import ReactDOM from "react-dom";

// Deprecated API usage
const factory = createFactory("span");

// Another deprecated API
class Legacy extends React.Component {
  componentDidMount() {
    const node = ReactDOM.findDOMNode(this);
    console.log(node);
  }
  render() {
    return factory({ className: "legacy" });
  }
}

export { factory, Legacy };
