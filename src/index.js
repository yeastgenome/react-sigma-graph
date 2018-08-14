import React from 'react';

import d3 from 'd3';
import sigma from 'sigma';

// sigma.js plugins from https://github.com/jacomyal/sigma.js/tree/master/plugins
import animate from './vendor/plugins.animate';
import './vendor/sigma.plugins.dragNodes';
import './vendor/sigma.renderers.snapshot';
import './vendor/edges.labels.curve';
import './vendor/edges.labels.curvedArrow';
import './vendor/edges.labels.def';
import './vendor/settings';

class ReactSigmaGraph extends React.Component {
  constructor(props) {
    super(props);
    this.lastNodes = [];
    this.canClick = true;
    this.state = {
      currentMaxValue: DEFAULT_MAX_VALUE
    };
    this.randomIdSegment = Math.random().toString(36).substring(7);
  }

  componentDidMount() {
    this.drawGraph();
  }

  componentDidUpdate (prevProps) {
    // see if stage changed
    let hasStage = typeof this.props.stage !== 'undefined';
    let shouldUpdate = hasStage ? (prevProps.stage !== this.props.stage) : this.didDataChange(prevProps.data, this.getData());
    if (shouldUpdate) {
      this.drawGraph();
    }
  }

  getTargetId() {
    return `${TARGET_ID_PREFIX}.${this.randomIdSegment}`;
  }

  // redirect to 'link' property of node data
  handleNodeClick(e) {
    if (!this.canClick) return;
    let newUrl = e.data.node.href;
    if (newUrl && window) {
      window.location.href = newUrl;
    }
  }

  handleDownload(e) {
    if (this.s) {
      this.s.renderers[0].snapshot({ download: true });
    }
  }

  handleMaxSizeChange() {
    let newValue = document.getElementById(`rGraphSlider.${this.randomIdSegment}`).value;
    this.setState({ currentMaxNodes: newValue });
    this.drawGraph();
  }

  didDataChange(prevData, newData) {
    let areNodesEqual = (prevData.nodes.length !== newData.nodes.length);
    let areEdgesEqual = (prevData.edges.length !== newData.edges.length);
    return (areNodesEqual && areEdgesEqual);
  }

  getData() {
    return this.props.data || DEFAULT_DATA;
  }

  getColorScale() {
    let data = this.getData();
    let catC = this.props.categoryColors;
    if (typeof catC === 'object') {
      function cScale(d) {
        return catC[d] || 'black';
      };
      cScale.domain = function cScaleDomain() {
        return Object.keys(catC)
      };
      return cScale;
    } else {
      let keys = data.nodes.map( d => d.category );
      let domain = keys.filter((x, i, a) => a.indexOf(x) == i);
      return d3.scale.category10().domain(domain);
    }
    
  }

  getHeight() {
    return MAX_HEIGHT;
  }

  // the edges need by d3 to calc format
  getFormattedLinks() {
    let nodes = this.getData().nodes;
    let edges = this.getEdges();
    function findIndexOfNodeById(id) {
      let thisNode = nodes.filter( d => d.id === id )[0];
      return nodes.indexOf(thisNode);
    }
    return edges.map( d => {
      let sourceIndex = findIndexOfNodeById(d.source);
      let targetIndex = findIndexOfNodeById(d.target);
      return { source: sourceIndex, target: targetIndex };
    });
  }

  getEdges() {
    let data = this.getData();
    let rawEdges = data.edges;
    let nodes = this.getNodes();
    let filteredEdges = rawEdges.filter( (d) => {
      let hasSource = nodes.filter( (_d) => {
        return (_d.id === d.source);
      }).length;
      let hasTarget = nodes.filter( (_d) => {
        return (_d.id === d.target);
      }).length;
      return (hasSource && hasTarget);
    });
    return filteredEdges.map( (d, i) => {
      d.id = `e${i}`;
      d.color = EDGE_COLOR;
      d.size = 2;
      return d;
    });
  }

  getNodes() {
    let colorScale = this.getColorScale();
    // only get state.currentMaxNodes
    var maxNodes = this.state.currentMaxNodes || DEFAULT_MAX_VALUE;
    return this.getData().nodes.slice(0, maxNodes).map( (d) => {
      d.color = colorScale(d.category);
      d.label = d.name;
      d.size = d.direct ? 1 : 0.5;
      return d;
    });
  }

  // calc static d3 force
  getFormattedNodes() {
    let nodes = this.getNodes();
    let links = this.getFormattedLinks();
    let force = d3.layout.force()
      .size([1, 1])
      .nodes(nodes)
      .links(links)
      .linkDistance(20);
    force.start();
    for (let i = 0; i <= N_TICKS; i++) {
      force.tick();
    }
    force.stop();
    // give start and end as x1, x2, y1, y2 for transition
    nodes = nodes.map( (d) => {
      // assign 'correct' to x2 y2
      let correctX = d.x;
      let correctY = d.y;
      // try to get old and assign to default x and y
      let oldNodes = this.lastNodes.filter( _d => d.id === _d.id );
      if (oldNodes.length) {
        let o = oldNodes[0];
        d.x = o.x2;
        d.y = o.y2;
      } else {
        d.x = DEFAULT_X;
        d.y = DEFAULT_Y;
      }
      d.x2 = correctX;
      d.y2 = correctY;
      return d;
    });
    this.lastNodes = nodes;
    return nodes;
  }

  drawGraph() {
    if (this.s) {
      this.s.graph.clear();
      this.s.refresh();
    } else {
      if (!sigma.classes.graph.hasMethod('neighbors')) {
        sigma.classes.graph.addMethod('neighbors', function(nodeId) {
        var k,
            neighbors = {},
            index = this.allNeighborsIndex[nodeId] || {};
        for (k in index)
          neighbors[k] = this.nodesIndex[k];
          return neighbors;
        });
      }
    }
    let _nodes = this.getFormattedNodes();
    let _edges = this.getEdges();
    if (!_nodes.length) return;
    let _graph = {
      nodes: _nodes,
      edges: _edges
    };
    this.s = new sigma({
      graph: _graph,
      renderers: [
        {
          container: this.getTargetId(),
          type: 'canvas'
        }
      ],
      settings: {
        animationsTime: TRANSITION_DURATION,
        edgeLabelSize: 'proportional',
        labelThreshold: 100,
        minNodeSize: 7,
        maxNodeSize: 7,
        minEdgeSize: 2,
        maxEdgeSize: 2,
        labelThreshold: 0,
        sideMargin: 4,
        zoomingRatio: 1
      }
    });
    animate(
      this.s,
      { x: 'x2', y: 'y2', size: 'size' },
      {
        duration: TRANSITION_DURATION
      }
    );
    this.s.bind('overNode', (e) => {
      var nodeId = e.data.node.id;
      var toKeep = this.s.graph.neighbors(nodeId);
      toKeep[nodeId] = e.data.node;
      this.s.graph.edges().forEach(function(e) {
        if (toKeep[e.source] && toKeep[e.target])
          e.color = HIGHLIGHTED_EDGE_COLOR;
        else
          e.color = EDGE_COLOR;;
      });
      this.s.refresh();
    });
    let dragListener = sigma.plugins.dragNodes(this.s, this.s.renderers[0]);
    dragListener.bind('startdrag', (e) => {
      this.canClick = false;
    });
    dragListener.bind('dragend', (e) => {
      setTimeout(() => {
        this.canClick = true;
      }, 50)
    });
    this.s.bind('clickNode', (e) => {
      this.handleNodeClick(e);
    });
  }

  renderHeader() {
    const NODE_SIZE = '0.8rem';
    let cScale = this.getColorScale();
    let nodes = cScale.domain().map( (d, i) => {
      let thisBg = cScale(d);
      return (
        <span key={`hl${i}`} style={{ fontSize: '0.9rem', marginRight: '1rem' }}><span style={{ background: thisBg, borderRadius: '0.5rem', display: 'inline-block', height: NODE_SIZE, position: 'relative', top: '0.1rem', width: NODE_SIZE }}></span> {d}</span>
      );
    });
    let headerText = this.props.headerText;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {nodes}
        </div>
        <div>
          {headerText}
        </div>
      </div>
    );
  }

  renderFooter() {
    let _onChange = debounce(this.handleMaxSizeChange, SIZE_DEBOUNCE).bind(this);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <label>Maximum Number of Nodes</label>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{DEFAULT_MAX_VALUE.toString()}</span>
              <span>{MAX_MAX_VALUE.toString()}</span>
            </div>
            <input type='range' style={{ minWidth: '15rem' }} min={DEFAULT_MAX_VALUE.toString()} max={MAX_MAX_VALUE.toString()} defaultValue={DEFAULT_MAX_VALUE.toString()} id={`rGraphSlider.${this.randomIdSegment}`}onChange={_onChange} />
          </div>
          <a className='button small secondary' onClick={this.handleDownload.bind(this)}><i className='fa fa-download' /> Download (.png)</a>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div id={`rGraphTarget${this.randomIdSegment}`} >
        {this.renderHeader()}
        <div style={{ position: 'relative' }}>
          <div id={this.getTargetId()} style={{ height: this.getHeight() }} />
        </div>
        {this.renderFooter()}
      </div>
    );
  }
}

// ReactSigmaGraph.propTypes = {
//   data: React.PropTypes.object, // { nodes: [], edges: [] }
//   headerText: React.PropTypes.string, // optional
//   colorScale: React.PropTypes.func, // optional, default to d3.scale.category10(d.category)
//   stage: React.PropTypes.number // optional to force animation 
// };

export default ReactSigmaGraph;

const DEFAULT_MAX_VALUE = 50;
const MAX_MAX_VALUE = 150;
const MAX_HEIGHT = 600;
const TARGET_ID_PREFIX = 'j-sigma-target';
const TRANSITION_DURATION = 1000;
const DEFAULT_X = 0;
const DEFAULT_Y = 0;
const N_TICKS = 180;
const EDGE_COLOR = '#e2e2e2';
const HIGHLIGHTED_EDGE_COLOR = '#808080';
const SIZE_DEBOUNCE = 1000;
const DEFAULT_COLOR_SCALE = d3.scale.category10();
const DEFAULT_DATA = { nodes: [{ id: 'a', category: 'cat', name: 'Garfield' }, { id: 'b', category: 'dog', name: 'Pluto' }], edges: [{ source: 'a', target: 'b', label: 'friend' }] };

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
// https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};
