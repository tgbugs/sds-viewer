import NodesFactory from './nodesFactory';

import {
    rdfTypes,
    type_key,
    typesModel,
    RDF_TO_JSON_TYPES
} from './graphModel';

import {
    subject_key,
    protocols_key,
    contributors_key
} from '../constants';

const N3 = require('n3');
const ttl2jsonld = require('@frogcat/ttl2jsonld').parse;

const TMP_FILE = ".tmp";

const SUBJECTS_LEVEL = 4;
const PROTOCOLS_LEVEL = 2, CRONTRIBUTORS_LEVEL = 2;


/*
 * Brief explanation of the Splinter module:
 *
 * This class is meant to take in input the json and turtle files that compose the sds datasets.
 * All the processing starts from the getGraph or getTree methods which call processDataset that does:
 *
 * # initialiseNodesEdges
 *   Initialise all the global vars, arrays and maps used to create the graph and tree.
 *
 * # processTurtle
 *   Through the library N3 it reads the turtle file to get triples of object-predicate-subject and the types.
 *
 * # processJSON
 *   Nothing fancy, just reading a json file.
 *
 * # create_graph
 *   It gets all the subjects that will be the nodes of our graph, it transform all the object as properties of the subjects,
 *   it cleans the array from empty nodes and then it calls organise_nodes() that reorganise the data per category based on the
 *   type of each node that will be casted using a factory and it arrange also the links between nodes accordingly.
 *   The factory defined in the same folder of this module, look at the code in case interested, it's quite simple.
 *
 * # create_tree
 *   It reads the json and create 2 maps, the tree_map where we keep each node by id.
 *   The second map, tree_parent_map, it is instead used to create the hierarchy since we store all the nodes by parent id, so
 *   once we get the tree root we can easily get the tree looking at the children of the root and then recursively we do the same
 *   until the children do not exists anymore in the tree_parent_map data structure, so that means we reached the end of that branch.
 *
 * # mergeData
 *   It links together the tree and the nodes of the graph, so that when we click on the graph we get the linked node on the tree
 *   and viceversa clicking on the tree. It also push some more data into the graph (the graph is generate from the turtle file)
 *   from the json file, since all the files that belongs to subjects and samples are stored in the json but we need to make them
 *   available also for the graph. This is where this operation is done.
 *
 * # generateData
 *   This is the last step where we take all the data created previously and manipulated to then create first of all the tree from
 *   the tree_parent_map. Once the tree is ready we then create the nodes for the graph and we fix the links broken at the mergeData
 *   step since some artificial nodes have been pushed into the nodes array that will be used for the graph.
 *
 */


class Splinter {
    constructor(jsonFile, turtleFile) {
        this.factory = new NodesFactory();
        this.jsonFile = jsonFile;
        this.turtleFile = turtleFile;
        this.types = {};
        this.jsonData = {};
        this.levelsMap = {};
        this.turtleData = [];
        this.tree = undefined;
        this.nodes = undefined;
        this.edges = undefined;
        this.root_id = undefined;
        this.tree_map = undefined;
        this.proxies_map = undefined;
        this.forced_edges = undefined;
        this.forced_nodes = undefined;
        this.tree_parents_map = undefined;
        this.dataset_id = this.processDatasetId();
        this.store = new N3.Store();
        this.rdf_to_json = undefined;
        this.rdf_to_json_map = undefined;
    }

    /* Initialise global maps before to start data manipulation */
    initialiseNodesEdges() {
        this.edges = [];
        this.nodes = new Map();
        this.tree_map = new Map();
        this.proxies_map = new Map();
        this.tree_parents_map = new Map();
        this.tree_parents_map2 = new Map();
        this.rdf_to_json_map = new Map();
    }


    extractJson() {
        if (typeof this.jsonFile === 'object' && this.jsonFile !== null) {
            return this.jsonFile;
        } else {
            return JSON.parse(this.jsonFile);
        }
    }


    extractTurtle() {
        var that = this;
        return new Promise(function(resolve, reject) {
            const parser = new N3.Parser();

            let callbackParse = function (err, quad, prefixes) {
                if (quad) {
                    that.store.addQuad(quad);
                    that.turtleData.push(quad);
                } else {
                    resolve(that.turtleData);
                }
            }

            const prefixCallback = function (prefix, iri) {
                that.types[String(prefix)] = {
                    "type": prefix,
                    "iri": iri
                };
            };
            parser.parse(that.turtleFile, callbackParse, prefixCallback);
        });
    }

    convertRDFToJson () {
        this.rdf_to_json = ttl2jsonld(this.turtleFile);
        this.rdf_to_json['@graph'].forEach(node => {
            let found = false;
            let toTrim = '';
            if (Array.isArray(node['@type'])) {
                found = RDF_TO_JSON_TYPES.some( item => {
                    if (node['@type'].includes(item.key)) {
                        toTrim = item.toTrim;
                        return true;
                    }
                    return false;
                });
            } else {
                found = RDF_TO_JSON_TYPES.some( item => {
                    if (node['@type'] === item.key) {
                        toTrim = item.toTrim;
                        return true;
                    }
                    return false;
                });
            }
            if (found) {
                let id = this.types[toTrim].iri.id + node['@id'].replace(toTrim + ':', '');
                this.rdf_to_json_map.set(id, node);
            }
        });
    }


    getJson() {
        return this.jsonData;
    }


    getTurtle() {
        return this.turtleData;
    }

    updateLevels(n, previousLevel) {
        n.map( node => {
            if ( node.level > previousLevel ){
                this.updateLevels(node.neighbors, node.level);
                node.level = node.level + 1;
            }
        });

        return;
    }

    async getGraph() {
        if (this.nodes === undefined || this.edges === undefined) {
            await this.processDataset();
        }

        let cleanLinks = [];
        let self = this;

        // Assign neighbors, to highlight links
        this.forced_edges.forEach(link => {
            // Search for existing links
            let existingLing = cleanLinks.find( l => l.source === link.source && l.target === link.target );
            if ( !existingLing ) {
                const a = self.forced_nodes.find( node => node.id === link.source );
                const b = self.forced_nodes.find( node => node.id === link.target );
                !a.neighbors && (a.neighbors = []);
                !b.neighbors && (b.neighbors = []);
                a.neighbors.push(b);
                b.neighbors.push(a);

                !a.links && (a.links = []);
                !b.links && (b.links = []);
                a.links.push(link);
                b.links.push(link);

                cleanLinks.push(link);
            }
        });

        // Calculate level with max amount of nodes
        let maxLevel = Object.keys(this.levelsMap).reduce((a, b) => this.levelsMap[a].length > this.levelsMap[b].length ? a : b);
        // Space between nodes
        let nodeSpace = 50;
        // The furthestLeft a node can be
        let furthestLeft = 0 - (Math.ceil(this.levelsMap[maxLevel].length)/2  * nodeSpace );
        let positionsMap = {};

        let levelsMapKeys = Object.keys(this.levelsMap);

        levelsMapKeys.forEach( level => {
            positionsMap[level] = furthestLeft + nodeSpace/2;
            this.levelsMap[level].sort((a, b) => a.attributes?.relativePath?.localeCompare(b.attributes?.relativePath));
        });

        this.levelsMap[3]?.sort((a, b) => a.parent?.type?.localeCompare(b.parent?.type));

        for ( let i = SUBJECTS_LEVEL; i <= maxLevel ; i++ ){
            this.levelsMap[i]?.sort( (a, b) => { 
                let aSubject = a
                while (aSubject.type !== "Subject" ){
                    aSubject = aSubject.parent;
                }
                let bSubject = b;
                while (bSubject.type !== "Subject" ){
                    bSubject = bSubject.parent;
                }
                return aSubject?.id > bSubject.id ? 1 : -1;
            });
        }

        console.log("Levels map ", this.levelsMap);
        
        // Start assigning the graph from the bottom up
        let neighbors = 0;
        levelsMapKeys.reverse().forEach( level => {
            this.levelsMap[level].forEach ( (n, index) => {
                neighbors = n?.neighbors?.filter(neighbor => { return neighbor.level > n.level });
                // FIXME : Fix this, beter way to create positioning
                if ( n.level === SUBJECTS_LEVEL + 1 ){
                    this.updateLevels(n.neighbors, n.level);
                    if ( neighbors.length > 0 ) n.level = n.level + 1;
                }
                if ( neighbors.length > 0 ) {
                    let max = Number.MIN_SAFE_INTEGER, min = Number.MAX_SAFE_INTEGER;
                    neighbors.forEach( neighbor => {
                        if ( neighbor.xPos > max ) { max = neighbor.xPos };
                        if ( neighbor.xPos < min ) { min = neighbor.xPos };
                    });
                    n.xPos = min === max ? min : min + (max - min) * .5;
                    positionsMap[n.level] = n.xPos + nodeSpace;
                } else {
                    n.xPos = positionsMap[n.level] + nodeSpace;
                    positionsMap[n.level] = n.xPos;
                }
            })
        });

        console.log(this.levelsMap);

        return {
            nodes: this.forced_nodes,
            links: cleanLinks,
            radialVariant : this.levelsMap[maxLevel].length,
            hierarchyVariant : maxLevel * 20
        };
    }


    async getTree() {
        if (this.tree === undefined) {
            await this.processDataset();
        }
        return this.tree;
    }


    getDatasetId() {
        return this.dataset_id;
    }


    async processTurtle() {
        await this.extractTurtle();
    }


    processDatasetId() {
        this.processJSON();
        return this.jsonData.data[0].dataset_id.replace('dataset:', '');
    }


    processJSON() {
        this.jsonData = this.extractJson()
    }


    /* Entry point for the whole conversion and graph/tree creation */
    async processDataset() {
        this.initialiseNodesEdges()
        await this.processTurtle();
        this.convertRDFToJson();
        this.processJSON();
        this.create_graph();
        this.create_tree();
        this.mergeData();
        this.generateData()
    }


    /* Creates a map of types that will be used by the graphModel.js in order to extract values from each type */
    get_type(node) {
        const typeFound = {
            type: typesModel.unknown.type,
            length: 0
        }
        for (const type of node?.types) {
            if (type.type === this.types.owl.iri.id + "NamedIndividual") {
                for (const rdfType in this.types) {
                    if ((node.id.includes(this.types[rdfType].iri.id)) && (this.types[rdfType].iri.id.length > typeFound.length) && (typesModel.NamedIndividual[String(this.types[rdfType].type)] !== undefined)) {
                        typeFound.type = typesModel.NamedIndividual[String(this.types[rdfType].type)].type;
                        typeFound.length = this.types[rdfType].iri.id.length;
                    }
                }
            } if (type.type === this.types.owl.iri.id + "Class") {
                for (const rdfType in this.types) {
                    if ((node.id.includes(this.types[rdfType].iri.id)) && (this.types[rdfType].iri.id.length > typeFound.length) && (typesModel.Class[String(this.types[rdfType].type)] !== undefined)) {
                        typeFound.type = typesModel.Class[String(this.types[rdfType].type)].type;
                        typeFound.length = this.types[rdfType].iri.id.length;
                    }
                }
            } else if (type.type === this.types.owl.iri.id + "Ontology") {
                typeFound.type = typesModel.ontology.type;
                typeFound.length = typesModel.ontology.length;
            } else if ((type.type.includes(this.types.sparc.iri.id)) && (typesModel.sparc[type.type.split(this.types.sparc.iri.id).pop()] !== undefined)) {
                let sparcType = type.type.split(this.types.sparc.iri.id).pop();
                typeFound.type = typesModel.sparc[sparcType].type;
                typeFound.length = typesModel.sparc[sparcType].length;
            }
        }
        return typeFound.type;
    }


    build_node(node) {
        const graph_node = this.nodes.get(node.id);
        const additional_properties = this.rdf_to_json_map.get(node.id);
        if (graph_node) {
            console.error("Issue with the build node, this node is already present");
            console.error(node);
        } else {
            this.nodes.set(node.id, {
                id: node.id,
                attributes: {},
                types: [],
                name: node.value,
                proxies: [],
                properties: [],
                tree_reference: null,
                children_counter: 0,
                additional_properties: additional_properties,
            });
        }
    }


    update_node(quad, proxy) {
        // check if the node is blank
        if (N3.Util.isBlankNode(quad.subject)) {
            return;
        }
        let graph_node = this.nodes.get(quad.subject.id);
        // check if node to update exists in the list of nodes.
        if (graph_node) {
            if (quad.predicate.id === type_key) {
                graph_node.types = [...graph_node.types, {
                    predicate: quad.predicate.id,
                    type: quad.object.datatype ? quad.object.datatype.id : quad.object.id,
                    value: quad.object.value
                }];
                this.nodes.set(quad.subject.id, graph_node);
            } else {
                graph_node.properties = [...graph_node.properties, {
                    predicate: quad.predicate.id,
                    type: quad.object.datatype ? quad.object.datatype.id : quad.object.id,
                    value: quad.object.value
                }];
                if (proxy) {
                    graph_node.proxies = [...graph_node.proxies, quad.object.id];
                    this.proxies_map.set(quad.object.id, quad.subject.id);
                }
                this.nodes.set(quad.subject.id, graph_node);
            }
        } else {
            // if the node does not exist there should be referenced by a proxy inside another node.
            var found = true;
            this.nodes.forEach((value, key) => {
                if (value.proxies.indexOf(String(quad.subject.id)) !== -1) {
                    value.properties = [...value.properties, {
                        predicate: quad.predicate.id,
                        type: quad.object.datatype,
                        value: quad.object.value
                    }];
                    value.proxies = [...value.proxies, quad.object.id];
                    this.proxies_map.set(quad.object.id, key);
                    this.nodes.set(key, value);
                    found = false;
                }
            });
            if (found) {
                // if we end up here it means we have a node with links to ids or proxy, so we do not know
                // where this node should go.
                console.error("Houston, we have a problem!");
                console.error(quad);
            }
        }
    }


    link_nodes(quad) {
        // before to create the node check that:
        // 1. subject and object are nodes in our graph
        // 2. we are not self referencing the node with a property that we don't need
        const source = this.nodes.get(quad.subject.id);
        const target = this.nodes.get(quad.object.id);
        if (source && target && (quad.subject.id !== quad.object.id)) {
            this.edges.push({
                source: quad.subject.id,
                target: quad.object.id
            });
            this.update_node(quad, false);
        } else {
            // if the conditions above are not satisfied we push this relationship as a proxy of another node already present
            this.update_node(quad, true);
        }
    }


    cast_nodes() {
        // prepare 2 place holders for the dataset and ontology node, the ontology node is not required but
        // we might need to display some of its properties, so we merge them.
        let dataset_node = undefined;
        let ontology_node = undefined;

        // cast each node to the right type, also keep trace of the dataset and ontology nodes.
        this.nodes.forEach((value, key) => {
            value.type = this.get_type(value);
            const typedNode = this.factory.createNode(value, this.types);
            if (typedNode.type !== rdfTypes.Unknown.key) {
                this.nodes.set(key, typedNode);
            } else {
                this.nodes.delete(key);
                this.edges = this.edges.filter(link => {
                    if (link.source !== key && link.target !== key) {
                        return true;
                    }
                    return false;
                })
            }
            if (value.type === typesModel.NamedIndividual.dataset.type) {
                dataset_node = value;
            }
            if (value.type === typesModel.ontology.type) {
                ontology_node = value;
            }
        });
        // save the dataset id used for the uri_api later with the tree
        this.root_id = dataset_node.id;
        // merge the 2 nodes together
        dataset_node.properties = dataset_node.properties.concat(ontology_node.properties);
        dataset_node.proxies = dataset_node.proxies.concat(ontology_node.proxies);
        dataset_node.level = 1;
        let updatedAbout = [];
        dataset_node.attributes.isAbout.forEach( (a) => {
            if( a.includes(rdfTypes.NCBITaxon.key) || a.includes(rdfTypes.PATO.key) || a.includes(rdfTypes.UBERON.key) ) {
                let node = this.nodes.get(a);
                if (node) {
                    updatedAbout.push({"value": node?.attributes.label[0], "link": node?.id});
                } else {
                    updatedAbout.push({"value": a});
                }
            } else {
                updatedAbout.push({"value": a});
            }
        });
        dataset_node.attributes.isAbout = updatedAbout;

        let updateTechniques = [];
        dataset_node.attributes.protocolEmploysTechnique?.forEach( (a) => {
            if( a.includes(rdfTypes.NCBITaxon.key) || a.includes(rdfTypes.PATO.key) || a.includes(rdfTypes.UBERON.key) ) {
                let node = this.nodes.get(a);
                if (node) {
                    updateTechniques.push({"value": node?.attributes.label[0], "link": node?.id});
                } else {
                    updateTechniques.push({"value": a});
                }
            } else {
                updateTechniques.push({"value": a});
            }
        });
        dataset_node.attributes.protocolEmploysTechnique = updateTechniques;
        this.nodes.set(dataset_node.id, dataset_node);
        this.nodes.delete(ontology_node.id);
        // fix links that were pointing to the ontology
        let temp_edges = this.edges?.map(link => {
            if (link.source === ontology_node.id) {
                link.source = dataset_node.id
            }
            if (link.target === ontology_node.id) {
                link.target = dataset_node.id
            }
            return link;
        })
        this.edges = temp_edges;
        return dataset_node;
    }


    organise_nodes(parent) {
        // structure the graph per category
        const id = parent.id;
        const subjects = {
            id: subject_key,
            name: "Subjects",
            type: typesModel.NamedIndividual.subject.type,
            properties: [],
            parent : parent,
            proxies: [],
            level: SUBJECTS_LEVEL,
            tree_reference: null,
            children_counter: 0
        };
        if (this.nodes.get(subject_key) === undefined) {
            this.nodes.set(subject_key, this.factory.createNode(subjects));
            this.edges.push({
                source: id,
                target: subjects.id
            })
        } else {
            console.error("The subjects node already exists!");
        }

        const protocols = {
            id: protocols_key,
            name: "Protocols",
            type: typesModel.sparc.Protocol.type,
            properties: [],
            parent : parent,
            proxies: [],
            level: PROTOCOLS_LEVEL,
            tree_reference: null,
            children_counter: 0
        };
        if (this.nodes.get(protocols_key) ===  undefined) {
            this.nodes.set(protocols_key, this.factory.createNode(protocols));
            this.edges.push({
                source: id,
                target: protocols.id
            })
        } else {
            console.error("The subjects node already exists!");
        }

        const contributors = {
            id: contributors_key,
            name: "Contributors",
            type: typesModel.NamedIndividual.contributor.type,
            properties: [],
            parent : parent,
            proxies: [],
            level: CRONTRIBUTORS_LEVEL,
            tree_reference: null,
            children_counter: 0
        };
        if (this.nodes.get(contributors_key) === undefined) {
            this.nodes.set(contributors_key, this.factory.createNode(contributors));
            this.edges.push({
                source: id,
                target: contributors.id
            })
        } else {
            console.error("The subjects node already exists!");
        }

        this.forced_edges = this.edges.filter(link => {
            if ((link.target === link.source)
            || (this.nodes.get(link.source).level === this.nodes.get(link.target).level)) {
                return false;
            }
            return true;
        }).map(link => {
            if (link.target === id) {
                var temp = link.target;
                link.target = link.source;
                link.source = temp;
            }
            let target_node = this.nodes.get(link.target);
            if (link.source === id && link.target !== subject_key && target_node.type === rdfTypes.Subject.key) {
                link.source = subject_key;
                target_node.level = subjects.level + 1;
                target_node.parent = subjects;
                this.nodes.set(target_node.id, target_node);
            } else if (link.source === id && link.target !== contributors_key && target_node.type === rdfTypes.Person.key) {
                link.source = contributors_key;
                target_node.level = contributors.level + 1;
                target_node.parent = contributors;
                this.nodes.set(target_node.id, target_node);
            } else if (link.source === id && link.target !== protocols_key && target_node.type === rdfTypes.Protocol.key) {
                link.source = protocols_key;
                target_node.level = protocols.level + 1;
                target_node.parent = protocols;
                this.nodes.set(target_node.id, target_node);
            } else if (link.source === id && target_node.type === rdfTypes.Sample.key) {
                link.source = target_node.attributes.derivedFrom[0];
                target_node.level = subjects.level + 2;
                target_node.parent = this.nodes.get(target_node.attributes.derivedFrom[0]);
                this.nodes.set(target_node.id, target_node);
            }
            let source_node = this.nodes.get(link.source);
            source_node.children_counter++;
            this.nodes.set(source_node.id, source_node);
            return link;
        }).filter(link => {
            let target_node = this.nodes.get(link.target);
            if ((link.source === id && (target_node.type !== rdfTypes.Award.key) && (link.target !== contributors_key && link.target !== subject_key && link.target !== protocols_key))) {
                return false;
            }
            return true;
        });
    }


    fix_links() {
        let nodesToRemove = [];

        this.forced_nodes.forEach((node, index, array) => {
            if (node.type === rdfTypes.Sample.key) {
                if (node.attributes.derivedFrom !== undefined) {
                    let source = this.nodes.get(node.attributes.derivedFrom[0]);
                    if ( source !== undefined ) {
                        source.children_counter++
                        //this.nodes.set(node.attributes.derivedFrom[0], source);
                        array[index].level = source.level + 1;
                        this.forced_edges.push({
                            source: node.attributes.derivedFrom[0],
                            target: node.id
                        });
                    }
                }
            }

            if (node.type === rdfTypes.Subject.key) {
                if (node.attributes?.specimenHasIdentifier !== undefined) {
                    let source = this.nodes.get(node.attributes.specimenHasIdentifier[0]);
                    if ( source !== undefined ) {
                        node.attributes.specimenHasIdentifier[0] = source.attributes.label[0];
                    }
                }
                if (node.attributes?.subjectSpecies !== undefined) {
                    let source = this.nodes.get(node.attributes.subjectSpecies[0]);
                    if ( source !== undefined ) {
                        node.attributes.subjectSpecies[0] = source.attributes.label[0];
                    }
                }
                if (node.attributes?.biologicalSex !== undefined) {
                    let source = this.nodes.get(node.attributes.biologicalSex[0]);
                    if ( source !== undefined ) {
                        node.attributes.biologicalSex[0] = source.attributes.label[0];
                    }
                }
            }

            if (node.type === rdfTypes.RRID.key || node.type === rdfTypes.NCBITaxon?.key || node.type === rdfTypes.PATO?.key) {
                nodesToRemove.unshift(index);
            }

            if ( node.level !== undefined ) {
                if ( this.levelsMap[node.level] ) {
                    this.levelsMap[node.level] = [...this.levelsMap[node.level], node];
                } else {
                    this.levelsMap[node.level] = [node];
                }
            }
        });

        nodesToRemove.forEach(element => {
            this.forced_nodes.splice(element, 1);
        })
    }

    identify_childless_parents() {
        this.forced_nodes.forEach((node, index, array) => {
            if ((node.type === rdfTypes.Sample.key || node.type === rdfTypes.Subject.key) && (node.children_counter === 0)) {
                node.img.src = "./images/graph/question_mark.svg"
            }
        });
    }


    create_graph() {
        // build nodes out of the subjects
        for (const node of this.store.getSubjects()) {
            if (!N3.Util.isBlankNode(node)) {
                this.build_node(node);
            }
        }

        // consume all the other nodes that will contain mainly literals/properties of the subject nodes
        for (const [index, quad] of this.turtleData.entries()) {
            if (N3.Util.isLiteral(quad.object) || quad.predicate.id === type_key) {
                // The object does not represent a node on his own but rather a property of the existing subject
                this.update_node(quad, false);
            } else {
                // I don't know yet what to do with this node
                this.link_nodes(quad);
            }
        }

        let dataset_node = this.cast_nodes();
        this.organise_nodes(dataset_node);
    }


    create_tree() {
        for (const leaf of this.jsonData.data) {
            this.tree_map.set(leaf.uri_api, leaf);
            if (leaf.parent_id === leaf.remote_id) {
                continue;
            }
            let children = this.tree_parents_map.get(leaf.parent_id);
            if (children) {
                this.tree_parents_map.set(leaf.parent_id, [...children, leaf]);
                this.tree_parents_map2.set(leaf.parent_id, [...children, leaf]);
            } else {
                this.tree_parents_map.set(leaf.parent_id, [leaf]);
                this.tree_parents_map2.set(leaf.parent_id, [leaf]);
            }
        }
    }

    /**
     * Exclude certain nodes
     * @param {*} node
     * @returns
     */
    filterNode = (node) => {
        return node.basename.includes(TMP_FILE)
    }


    mergeData() {
        this.nodes.forEach((value, key) => {
            if (value.attributes !== undefined && value.attributes.hasFolderAboutIt !== undefined) {
                value.attributes.hasFolderAboutIt.forEach(folder => {
                    let jsonNode = this.tree_map.get(folder);
                    let newNode = this.buildFolder(jsonNode, value);
                    let folderChildren = this.tree_parents_map2.get(newNode.parent_id)?.map(child => {
                        child.parent_id = newNode.uri_api
                        return child;
                    });

                    if (!this.filterNode(newNode) && (this.nodes.get(newNode.remote_id)) === undefined) {
                        this.linkToNode(newNode, value);
                    }

                    if (this.tree_parents_map2.get(newNode.uri_api) === undefined) {
                        this.tree_parents_map2.set(newNode.uri_api, folderChildren);
                        this.tree_parents_map2.delete(newNode.parent_id);
                        folderChildren?.forEach(child => {
                            const child_node = this.nodes.get(this.proxies_map.get(child.uri_api));
                            if (!this.filterNode(child) && child_node?.type !== rdfTypes.Sample.key) {
                                this.linkToNode(child, this.nodes.get(newNode.remote_id));
                            }
                        });
                    } else {
                        let tempChildren = folderChildren === undefined ? [...this.tree_parents_map2.get(newNode.uri_api)] : [...this.tree_parents_map2.get(newNode.uri_api), ...folderChildren];;
                        this.tree_parents_map2.set(newNode.uri_api, tempChildren);
                        this.tree_parents_map2.delete(newNode.parent_id);
                        tempChildren?.forEach(child => {
                            const child_node = this.nodes.get(this.proxies_map.get(child.uri_api));
                            if (!this.filterNode(child) && child_node?.type !== rdfTypes.Sample.key) {
                                this.linkToNode(child, this.nodes.get(newNode.remote_id));
                            }
                        });
                    }
                })
            }
        });
    }

    buildFolder(item) {
        let copiedItem = {...item};
        let newName = copiedItem.dataset_relative_path.split('/')[0];
        copiedItem.parent_id = copiedItem.remote_id;
        copiedItem.remote_id = copiedItem.basename + '_' + newName;
        copiedItem.uri_api = copiedItem.remote_id;
        copiedItem.basename = newName;
        // copiedItem.basename = copiedItem.remote_id;
        return copiedItem;
    }


    linkToNode(node, parent) {
        let level = parent.level;
        if (parent.type === rdfTypes.Sample.key) {
            if (parent.attributes.derivedFrom !== undefined) {
                level = this.nodes.get(parent.attributes.derivedFrom[0]).level + 1;
            }
        }
        parent.children_counter++;
        const new_node = this.buildNodeFromJson(node, level);
        new_node.parent = parent;
        this.forced_edges.push({
            source: parent.id,
            target: new_node.id
        });
        this.nodes.set(new_node.id, this.factory.createNode(new_node));
        var children = this.tree_parents_map2.get(node.remote_id);
        if (children?.length > 0) {
            children.forEach(child => {
                !this.filterNode(child) && this.linkToNode(child, new_node);
            });
        }
    }


    buildNodeFromJson(item, level) {
        const node_id = this.proxies_map.get(item.uri_api);
        if (node_id) {
            return this.nodes.get(node_id);
        }
        const new_node = {
            id: item.uri_api,
            level: level + 1,
            attributes: {
                identifier: item.basename,
                relativePath: item.dataset_relative_path,
                size: item.size_bytes,
                mimetype: item.mimetype,
                updated: item.timestamp_updated,
                status: item.status,
            },
            types: [],
            name: item.basename,
            proxies: [],
            properties: [],
            type: item.mimetype === "inode/directory" ? "Collection" : "File",
            tree_reference: null,
            children_counter: 0
        };
        return this.factory.createNode(new_node, []);
    }


    generateData() {
        // generate the tree
        var tree_root = this.tree_map.get(this.root_id);
        var children = this.tree_parents_map.get(tree_root?.remote_id);
        this.tree_parents_map?.delete(tree_root?.remote_id);
        this.tree = this.generateLeaf(tree_root);
        children.forEach(leaf => {
            this.build_leaf(leaf, this.tree);
        });

        // generate the Graph
        this.forced_nodes = Array.from(this.nodes).map(([key, value]) => {
            let tree_node = this.tree_map.get(value.id);
            if (tree_node) {
                value.tree_reference = tree_node;
                this.nodes.set(key, value);
                tree_node.graph_reference = value;
                this.tree_map.set(value.id, tree_node);
            } else {
                value.proxies.every(proxy => {
                    tree_node = this.tree_map.get(proxy);
                    if (tree_node) {
                        value.tree_reference = tree_node;
                        this.nodes.set(key, value);
                        tree_node.graph_reference = value;
                        this.tree_map.set(proxy, tree_node);
                        return false;
                    }
                    return true;
                })
            }
            return value;
        })

        this.fix_links();
        this.identify_childless_parents();
    }

    build_leaf(node, parent) {
        var newChild = this.generateLeaf(node, parent);
        parent.items.push(newChild);

        var children = this.tree_parents_map.get(node.remote_id);
        this.tree_parents_map.delete(node.remote_id);
        if (children) {
            children.forEach(child => {
                this.build_leaf(child, newChild);
            });
        }
    }

    generateLeaf(node, parent) {
        node.id = node?.uri_api
        node.parent = true;
        node.text = parent !== undefined ? node?.basename : this.dataset_id;
        node.type = node.mimetype === "inode/directory" ? rdfTypes.Collection.key : rdfTypes.File.key;
        node.path = (parent !== undefined && parent.path !== undefined) ? [node.id, ...parent.path] : [node.id];
        if (!node.items) {
            node.items = [];
        }
        node.graph_reference = this.findReference(node.uri_api);
        this.tree_map.set(node.id, node);
        const newNode = {
            id: node.uri_api,
            text: node.text,
            items: node.items,
            graph_reference: node?.graph_reference?.id,
            path: node.path
        }
        return newNode;
    }

    findReference(id) {
        var reference = this.nodes.get(id);
        if (reference === undefined) {
            this.nodes.forEach((value, key) => {
                if (value.proxies.indexOf(String(id)) !== -1) {
                    reference = value;
                }
            });
        }
        return reference;
    }
}

export default Splinter;
