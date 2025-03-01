import * as d3 from 'd3';
import Menu from '@material-ui/core/Menu';
import { IconButton } from '@material-ui/core';
import MenuItem from '@material-ui/core/MenuItem';
import React, { useState, useEffect } from 'react';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import LayersIcon from '@material-ui/icons/Layers';
import ZoomOutIcon from '@material-ui/icons/ZoomOut';
import RefreshIcon from '@material-ui/icons/Refresh';
import { selectInstance } from '../../redux/actions';
import CircularProgress from '@material-ui/core/CircularProgress';
import { useSelector, useDispatch } from 'react-redux';
import FormatAlignCenterIcon from '@material-ui/icons/FormatAlignCenter';
import GeppettoGraphVisualization from '@metacell/geppetto-meta-ui/graph-visualization/Graph';
import { GRAPH_SOURCE } from '../../constants';
import { rdfTypes } from '../../utils/graphModel';

const NODE_FONT = '500 6px Inter, sans-serif';
const ONE_SECOND = 1000;
const LOADING_TIME = 3000;
const ZOOM_DEFAULT = 1;
const ZOOM_SENSITIVITY = 0.2;
const GRAPH_COLORS = {
  link: '#CFD4DA',
  linkHover : 'purple',
  hoverRect: '#CFD4DA',
  textHoverRect: '#3779E1',
  textHover: 'white',
  textColor: '#2E3A59',
};
const TOP_DOWN = {
  label : "Top Down",
  layout : "td",
  maxNodesLevel : (graph) => { 
    return graph.hierarchyVariant;
  }
};
const RADIAL_OUT = {
  label : "Radial",
  layout : "null",
  maxNodesLevel : (graph) => { 
    return graph.radialVariant
  }
};

const roundRect = (ctx, x, y, width, height, radius, color, alpha) => {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.globalAlpha = alpha || 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
};

const GraphViewer = (props) => {
  const dispatch = useDispatch();
  const graphRef = React.useRef(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedLayout, setSelectedLayout] = React.useState(TOP_DOWN);
  const [layoutAnchorEl, setLayoutAnchorEl] = React.useState(null);
  const [cameraPosition, setCameraPosition] = useState({ x : 0 , y : 0 });
  const open = Boolean(layoutAnchorEl);
  const [loading, setLoading] = React.useState(false);

  const nodeSelected = useSelector(state => state.sdsState.instance_selected.graph_node);
  const layout = useSelector(state => state.sdsState.layout);

  const handleLayoutClick = (event) => {
    setLayoutAnchorEl(event.currentTarget);
  };

  const handleLayoutClose = () => {
    setLayoutAnchorEl(null);
  };

  const handleLayoutChange = (target) => {
    handleLayoutClose()
    setSelectedLayout(target);
  };

  const handleNodeLeftClick = (node, event) => {
    dispatch(selectInstance({
      dataset_id: props.graph_id,
      graph_node: node.id,
      tree_node: node?.tree_reference?.id,
      source: GRAPH_SOURCE
    }));
  };

  const handleLinkColor = link => {
    let linkColor = GRAPH_COLORS.link;
    if ( highlightLinks.has(link) ) {
      linkColor = highlightNodes.has(link.source) || highlightNodes.has(link.target) ? GRAPH_COLORS.linkHover : GRAPH_COLORS.link;
    }

    return linkColor;
  };

  /**
   * Zoom to node when doing a right click on it
   * @param {*} node 
   * @param {*} event 
   */
  const handleNodeRightClick = (node, event) => {
    graphRef?.current?.ggv?.current.centerAt(node.x, node.y, ONE_SECOND);
    graphRef?.current?.ggv?.current.zoom(2, ONE_SECOND);
    setCameraPosition({ x :  node.x , y :  node.y });
  };


  /**
   * Zoom in
   * @param {*} event 
   */
  const zoomIn = (event) => {
    let zoom = graphRef.current.ggv.current.zoom();
    let value = ZOOM_DEFAULT;
    if (zoom < 2) {
      value = ZOOM_SENSITIVITY;
    }
    graphRef.current.ggv.current.zoom(zoom + value, ONE_SECOND / 10);
  };


  /**
   * Zoom out
   * @param {*} event
   */
  const zoomOut = (event) => {
    let zoom = graphRef.current.ggv.current.zoom();
    let value = ZOOM_DEFAULT;
    if (zoom < 2) {
      value = ZOOM_SENSITIVITY;
    }
    graphRef.current.ggv.current.zoom(zoom - value, ONE_SECOND / 10);
  };


  /**
   * Reset camera position
   */
  const resetCamera = () => {
    graphRef?.current?.ggv?.current.zoomToFit();
    let center =  graphRef?.current?.ggv?.current.centerAt();
    setCameraPosition({ x :  center.x , y :  center.y });
  };

  const onEngineStop = () => {
    resetCamera();
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    setTimeout ( () => setLoading(false) , LOADING_TIME);
  }, []);

  useEffect(() => {
    if (nodeSelected && nodeSelected?.id !== selectedNode?.id) {
      let node = graphRef?.current?.props?.data?.nodes.find( item => item.id === nodeSelected.id && item.parent?.id === nodeSelected.parent?.id );
      if (node) {
        handleNodeRightClick(node, null);
        setSelectedNode(node);
        setHoverNode(node);
      }
    }
  }, [nodeSelected]);

  //Resume animation after component is updated, fixes issue with graphics going crazy.
  useEffect(() => {
    // selectedNode && handleNodeRightClick(selectedNode, null);
    graphRef?.current?.ggv?.current.centerAt(cameraPosition.x, cameraPosition.y);
    graphRef?.current?.ggv?.current.d3Force('collide', d3.forceCollide(4));
    graphRef?.current?.ggv?.current.d3Force("manyBody", d3.forceManyBody().strength(-100))
  },[layout]);

  const handleNodeHover = (node) => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node);
      node.neighbors?.forEach(neighbor => highlightNodes.add(neighbor));
      node.links?.forEach(link => highlightLinks.add(link));
    }

    setHoverNode(node);
    setHighlightLinks(highlightLinks);
    setHighlightNodes(highlightNodes);
  };

  const handleLinkHover = link => {
    // Reset maps of hover nodes and links
    highlightNodes.clear();
    highlightLinks.clear();

    // We found link being hovered
    if (link) {
      // Keep track of hovered link, and it's source/target node
      highlightLinks.add(link);
      highlightNodes.add(link.source);
      highlightNodes.add(link.target);
    }

    setHighlightLinks(highlightLinks);
    setHighlightNodes(highlightNodes);
  }

  const paintNode = React.useCallback(
    (node, ctx) => {
      const size = 10;
      const nodeImageSize = [size * 2.4, size * 2.4];
      const hoverRectDimensions = [size * 4, size * 4];
      const hoverRectPosition = [node.x - 20, node.y - 14];
      const textHoverPosition = [
        hoverRectPosition[0],
        hoverRectPosition[1] + hoverRectDimensions[1] + 2,
      ];
      const hoverRectBorderRadius = 2;
      ctx.beginPath();

      try {
        ctx.drawImage(
          node?.img,
          node.x - size - 1,
          node.y - size,
          ...nodeImageSize
        );
      } catch (error) {
        const img = new Image();
        img.src = rdfTypes.Unknown.image;
        node.img = img;

        // Add default icon if new icon wasn't found under images
        ctx.drawImage(
          node?.img,
          node.x - size - 1,
          node.y - size,
          ...nodeImageSize
        );
      }

      ctx.font = NODE_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let nodeName = node.name;
      if (nodeName.length > 10) {
        nodeName = nodeName.substr(0, 10).concat('...');
      } else if ( Array.isArray(nodeName) ){
        nodeName = nodeName[0]?.substr(0, 10).concat('...');
      }
      const textProps = [nodeName, node.x + 2, textHoverPosition[1] + 4.5];
      if (node === hoverNode || node?.id === selectedNode?.id || node?.id === nodeSelected?.id ) {
        // image hover
        roundRect(
          ctx,
          ...hoverRectPosition,
          ...hoverRectDimensions,
          hoverRectBorderRadius,
          GRAPH_COLORS.hoverRec,
          0.3
        );
        // text node name hover
        roundRect(
          ctx,
          ...textHoverPosition,
          hoverRectDimensions[0],
          hoverRectDimensions[0] / 4,
          hoverRectBorderRadius,
          GRAPH_COLORS.textHoverRect
        );
        // reset canvas fill color
        ctx.fillStyle = GRAPH_COLORS.textHover;
      } else {
        ctx.fillStyle = GRAPH_COLORS.textColor;
      }
      ctx.fillText(...textProps);
    },
    [hoverNode]
  );

  let maxNodesLevel = selectedLayout.maxNodesLevel(window.datasets[props.graph_id].graph);
  return (
    <div className={'graph-view'}>
      { loading?
      <CircularProgress style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        margin: 'auto',
        color: "#11bffe",
        size: "55rem"
      }} />
      :
      <GeppettoGraphVisualization
        ref={graphRef}
        // Graph data with Nodes and Links to populate
        data={window.datasets[props.graph_id].graph}
        // Create the Graph as 2 Dimensional
        d2={true}
        warmupTicks={1000}
        cooldownTicks={50}
        onEngineStop={onEngineStop}
        // Links properties
        linkColor = {handleLinkColor}
        linkWidth={2}
        forceChargeStrength={maxNodesLevel * -5}
        linkDirectionalParticles={1}
        linkCurvature={link => {
          let curve = 0;

          if ( selectedLayout.layout !== RADIAL_OUT.layout ){
            if ( link.source.fx > link.target.fx ) {
              curve = curve * -1;
            }
            else if ( link.source.fx === link.target.fx ) {
              curve = 0;
            } else if ( link.source.fx >= link.target.fx ) {
              curve = -.05;
            } else {
              curve = .05;
            }
          }

          return curve;
        }}
        linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 4 : 0}
        linkCanvasObjectMode={'replace'}
        onLinkHover={handleLinkHover}
        // Override drawing of canvas objects, draw an image as a node
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={node => 'replace'}
        nodeVal = { node => {
          if ( selectedLayout.layout !== RADIAL_OUT.layout ){
            node.fx = node.xPos;
            node.fy = 100 * node.level;
          }
        }}
        onNodeHover={handleNodeHover}
        // Allows updating link properties, as color and curvature. Without this, linkCurvature doesn't work.
        onNodeClick={(node, event) => handleNodeLeftClick(node, event)}
        onNodeRightClick={(node, event) => handleNodeRightClick(node, event)}
        // td = Top Down, creates Graph with root at top
        dagMode={selectedLayout.layout}
        // Handles error on graph
        onDagError={(loopNodeIds) => {}}
        // Disable dragging of nodes
        enableNodeDrag={false}
        // Allow camera pan and zoom with mouse
        enableZoomPanInteraction={true}
        enablePointerInteraction={true}
        // React element for controls goes here
        controls={
          <div className='graph-view_controls'>
            <IconButton aria-controls="layout-menu" aria-haspopup="true" onClick={handleLayoutClick}>
              <FormatAlignCenterIcon />
            </IconButton>
            <Menu
              id="layout-menu"
              anchorEl={layoutAnchorEl}
              keepMounted
              open={open}
              onClose={handleLayoutClose}
            >
              <MenuItem selected={RADIAL_OUT.layout === selectedLayout.layout} onClick={() => handleLayoutChange(RADIAL_OUT)}>{RADIAL_OUT.label}</MenuItem>
              <MenuItem selected={TOP_DOWN.layout === selectedLayout.layout} onClick={() => handleLayoutChange(TOP_DOWN)}>{TOP_DOWN.label}</MenuItem>
            </Menu>
            <IconButton onClick={(e) => zoomIn()}>
              <ZoomInIcon />
            </IconButton>
            <IconButton onClick={(e) => zoomOut()}>
              <ZoomOutIcon />
            </IconButton>
            <IconButton onClick={(e) => resetCamera()}>
              <RefreshIcon />
            </IconButton>
            <LayersIcon />
          </div>
        }
      />
    }
    </div>
  );
};

export default GraphViewer;
