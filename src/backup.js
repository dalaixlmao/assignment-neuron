import React, { useState, useEffect, useMemo, useRef } from "react";
import { render } from "react-dom";
import ReactMapGL, { Source, Layer } from "react-map-gl";
import { Marker } from "react-map-gl";
import "./App.css";
import "mapbox-gl/dist/mapbox-gl.css";
import * as d3 from "d3";
import pinIcon from "./assets/pin.svg"; // Import the pin icon image
import Select from "react-select";
import SailingIcon from "@mui/icons-material/Sailing";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Loader from "./Loader";
import MAPBOX_TOKEN from "./Config";
import axios from 'axios'; // Import Axios library

const TOKEN = MAPBOX_TOKEN;

const dottedData = [
  [1, 0],
  [1, 2],
  [0.9, 3],
  [0.8, 4],
  [0.7, 5],
  [0.6, 6],
  [0.5, 7],
  [0.4, 8],
  [0.3, 9],
  [0.2, 10],
];
const colorData = [
  "#FF0000",
  "#E60000",
  "#CC0000",
  "#B30000",
  "#990000",
  "#800000",
  "#660000",
  "#4D0000",
  "#330000",
];

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewPort, setViewPort] = useState({
    latitude: 28.6448,
    longitude: 77.216,
    zoom: 2,
  });
  const [shipData, setShipData] = useState([]);
  const [portData, setPortData] = useState([]);
  const [selectedShip, setSelectedShip] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [customLatitude, setCustomLatitude] = useState(null);
  const [customLongitude, setCustomLongitude] = useState(null);
  const [shipVisited, setShipVisited] = useState([]);
  const [shipClicked, setShipClicked] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // State to manage panel open/close
  const [shipsVisitedPort, setShipsVisitedPort] = useState([]);
  const mapRef = useRef();
  const [portLatitude, setPortLatitude] = useState(null);
  const [portLongitude, setPortLongitude] = useState(null);

  let isUserInteracting = false;

  let p = 0;
  useEffect(() => {
    async function fetchData() {
      try {
        if (p === 0) {
          p++;
          // PORT-------------------------------------
          const portURL="https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6SvR1V4Wu1Tj2pnmplfFxGtuvbJKy0XLOTex-4O--N9VKeVokgsJyuK8_D2dm_qwWjF74vVTfvrEp/pub?output=csv";
          const response1 = await axios.get("../ports_data.csv");
          console.log(response1);
          const text1 = await response1.text();
          const data1 = d3.csvParse(text1);
          const parsedMarkers = data1.map((d) => ({
            name: d.port_name,
            latitude: parseFloat(d.geo_location_latitude),
            longitude: parseFloat(d.geo_location_longitude),
          }));

          setPortData(parsedMarkers);
          console.log(parsedMarkers);

          // SHIP-------------------------------------
          const shipURL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTFVt7dQoEB1bL5E0Xd9J5utuU18xuru0np9RhqWoyKQf4JIo500VbXvgmUuVKOdzI8iIpEbvjMordp/pub?output=csv";
          const ship = {};
          const response = await axios.get("../ship_data.csv");
          const text = await response.text();
          const data = d3.csvParse(text);
          data.forEach((d) => {
            const shipName = d.site_name;
            const timestamp = new Date(d.ec_timestamp);
            const dateKey = timestamp.toISOString().slice(0, 10); // Extract YYYY-MM-DD from timestamp
            ship[shipName] = ship[shipName] || {};
            ship[shipName][dateKey] = ship[shipName][dateKey] || [];
            ship[shipName][dateKey].push({
              latitude: parseFloat(d.location_latitude),
              longitude: parseFloat(d.location_longitude),
            });

            ship[shipName][dateKey].sort((a, b) => a.timestamp - b.timestamp);
          });
          setShipData(ship);
          console.log(ship);

          const restructuredShipData = {};
          Object.keys(ship).forEach((shipName) => {
            restructuredShipData[shipName] = {};
            Object.keys(ship[shipName]).forEach((dateKey) => {
              ship[shipName][dateKey].forEach((coord) => {
                const latKey = parseInt(coord.latitude.toFixed(2)); // Using latitude as integer key
                const lonKey = parseInt(coord.longitude.toFixed(2)); // Using longitude as nested integer key
                restructuredShipData[shipName][latKey] =
                  restructuredShipData[shipName][latKey] || {};
                restructuredShipData[shipName][latKey][lonKey] =
                  restructuredShipData[shipName][latKey][lonKey] || [];
                restructuredShipData[shipName][latKey][lonKey].push(coord);
              });
            });

            // Sort coordinates based on latitude
            Object.keys(restructuredShipData[shipName]).forEach((latKey) => {
              Object.keys(restructuredShipData[shipName][latKey]).forEach(
                (lonKey) => {
                  restructuredShipData[shipName][latKey][lonKey].sort(
                    (a, b) => a.latitude - b.latitude
                  );
                }
              );
            });
          });

          // Use restructuredShipData instead of shipData
          console.log("restructed ship data", restructuredShipData);
          setShipVisited(restructuredShipData);
          if (restructuredShipData.length != 0) setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Error fetching data. Please try again.");
      }
    }

    fetchData();
  }, []);

  if (p) setLoading(false);
  useEffect(() => {
    const latestCoordinates = getLatestCoordinates();
    if (latestCoordinates && mapRef.current && !isUserInteracting) {
      mapRef.current.flyTo({
        center: [latestCoordinates.longitude, latestCoordinates.latitude],
        zoom: 6,
        duration: 2000,
      });
    }
    const onInteractionStart = () => {
      isUserInteracting = true;
    };

    const onInteractionEnd = () => {
      isUserInteracting = false;
    };

    // Subscribe to MapGL events
    if (mapRef.current) {
      mapRef.current.getMap().on("mousedown", onInteractionStart);
      mapRef.current.getMap().on("touchstart", onInteractionStart);
      mapRef.current.getMap().on("mouseup", onInteractionEnd);
      mapRef.current.getMap().on("touchend", onInteractionEnd);
    }

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.getMap().off("mousedown", onInteractionStart);
        mapRef.current.getMap().off("touchstart", onInteractionStart);
        mapRef.current.getMap().off("mouseup", onInteractionEnd);
        mapRef.current.getMap().off("touchend", onInteractionEnd);
      }
    };
  }, [selectedShip]);

  function shipValue(name) {
    return "Ship " + name.slice(5);
  }
  function shipID(name) {
    console.log(name);
    return "ship_" + name.slice(5);
  }
  // Ship Lines
  const shipOptions = Object.keys(shipData)
    .map((shipName) => ({
      value: shipName,
      label: shipValue(shipName),
    }))
    .sort((a, b) => {
      const shipNumA = parseInt(a.label.replace("Ship ", ""));
      const shipNumB = parseInt(b.label.replace("Ship ", ""));
      return shipNumA - shipNumB;
    });

  const portOptions = portData.map((port) => ({
    value: port.name,
    label: port.name,
  }));

  const getLatestCoordinates = () => {
    if (!selectedShip || !shipData[selectedShip]) return null;

    const dates = Object.keys(shipData[selectedShip]);
    const lastDate = dates[0];
    const latestCoordinates = shipData[selectedShip][lastDate];
    return latestCoordinates[0];
  };

  // (selectedOption) => setSelectedShip(selectedOption.value)
  function handleChangeShip(e) {
    setSelectedShip(e.value);

    if (mapRef.current) {
      const latestCoordinates = getLatestCoordinates();
      if (latestCoordinates) {
        mapRef.current.flyTo({
          center: [latestCoordinates.longitude, latestCoordinates.latitude],
          duration: 2000,
        });
      }
    }
  }
  function handleChangePort(e) {
    setSelectedPort(e.value);

    // Find the latitude and longitude of the selected port
    const selectedPortData = portData.find((port) => port.name === e.value);
    setPortLatitude(selectedPortData.latitude);
    setPortLongitude(selectedPortData.longitude);

    // Set the viewport to the coordinates of the selected port
    setViewPort((prevViewport) => ({
      ...prevViewport,
      latitude: selectedPortData.latitude,
      longitude: selectedPortData.longitude,
      zoom: 6, // You may adjust the zoom level as needed
    }));

    // Find ships that have visited the port
    const shipsVisitedPortSet = new Set();
    Object.keys(shipVisited).forEach((shipName) => {
      Object.keys(shipVisited[shipName]).forEach((latKey) => {
        Object.keys(shipVisited[shipName][latKey]).forEach((lonKey) => {
          const shipCoordinates = shipVisited[shipName][latKey][lonKey];
          shipCoordinates.forEach((coord) => {
            // Check if ship's coordinates are near the port's coordinates
            if (
              Math.abs(coord.latitude - portLatitude) <= 0.01 &&
              Math.abs(coord.longitude - portLongitude) <= 0.01
            ) {
              shipsVisitedPortSet.add(shipName);
            }
          });
        });
      });
    });

    // Convert Set to array
    const shipsVisitedPortArray = Array.from(shipsVisitedPortSet);
    setShipsVisitedPort(shipsVisitedPortArray);
    setIsPanelOpen(true);

    console.log("Ships visited port:", shipsVisitedPort);
  }

  return (
    <div className="dis">
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="selectors">
            <Select
              options={shipClicked ? shipOptions : portOptions}
              onChange={shipClicked ? handleChangeShip : handleChangePort}
              value={shipClicked ? selectedShip : selectedPort}
              placeholder={
                shipClicked ? "Select a ship..." : "Select a port..."
              }
              isClearable
              components={{ SearchRoundedIcon }}
              styles={{
                option: (provided, state) => ({
                  ...provided,
                  color: state.isSelected ? "white" : "black", // Set text color
                  backgroundColor: state.isFocused ? "gray" : "white", // Set background color on hover
                  ":active": {
                    backgroundColor: "gray", // Set background color when option is active
                  },
                }),
                control: (provided) => ({
                  ...provided,
                  borderColor: "gray", // Set border color
                }),
              }}
            />
          </div>

          <div className="map">
            <ReactMapGL
              ref={mapRef}
              {...viewPort}
              width="100vw"
              height="100vh"
              mapboxAccessToken={TOKEN}
              mapStyle={"mapbox://styles/mapbox/satellite-streets-v11"}
              onMove={(evt) => setViewPort(evt.viewState)}
            >
              {/* Display ship lines based on selected ship */}
              {selectedShip &&
                Object.keys(shipData).map(
                  (shipName, shipIndex) =>
                    shipName === selectedShip &&
                    Object.keys(shipData[shipName]).map(
                      (dateKey, dateIndex) => (
                        <Source
                          key={`${shipIndex}-${dateIndex}`}
                          type="geojson"
                          data={{
                            type: "Feature",
                            geometry: {
                              type: "LineString",
                              coordinates: shipData[shipName][dateKey].map(
                                (coord) => [coord.longitude, coord.latitude]
                              ),
                            },
                          }}
                        >
                          <Layer
                            type="line"
                            id={`line-layer-${shipIndex}-${dateIndex}`}
                            paint={{
                              "line-color": colorData[dateIndex],
                              "line-width": 2,
                              "line-dasharray": dottedData[dateIndex],
                            }}
                          />
                        </Source>
                      )
                    )
                )}

              {selectedPort && (
                <>
                  {/* Iterate through all ships */}
                  {Object.keys(shipData).map(
                    (shipName, shipIndex) =>
                      // Check if the ship has visited the selected port
                      shipsVisitedPort.includes(shipName) &&
                      // Render the ship lines if it has visited the port
                      Object.keys(shipData[shipName]).map(
                        (dateKey, dateIndex) => (
                          <Source
                            key={`${shipIndex}-${dateIndex}`}
                            type="geojson"
                            data={{
                              type: "Feature",
                              geometry: {
                                type: "LineString",
                                coordinates: shipData[shipName][dateKey].map(
                                  (coord) => [coord.longitude, coord.latitude]
                                ),
                              },
                            }}
                          >
                            <Layer
                              type="line"
                              id={`line-layer-${shipIndex}-${dateIndex}`}
                              paint={{
                                "line-color": colorData[dateIndex],
                                "line-width": 2,
                                "line-dasharray": dottedData[dateIndex],
                              }}
                            />
                          </Source>
                        )
                      )
                  )}
                </>
              )}

              {selectedShip && (
                <>
                  {/* Marker for ship icon */}
                  <Marker
                    latitude={getLatestCoordinates().latitude}
                    longitude={getLatestCoordinates().longitude}
                  >
                    <img
                      src={pinIcon}
                      alt="Ship Icon"
                      style={{ width: 40, height: 40 }}
                    />
                  </Marker>
                  {/* Marker for ship name label */}
                  <Marker
                    latitude={getLatestCoordinates().latitude}
                    longitude={getLatestCoordinates().longitude}
                    offsetLeft={0}
                    offsetTop={-20}
                  >
                    <div
                      style={{
                        color: "white",
                        background: "rgba(0, 0, 0, 0.7)",
                        padding: "5px",
                        borderRadius: "5px",
                        marginBottom: "5rem",
                      }}
                    >
                      {selectedShip}
                    </div>
                  </Marker>
                </>
              )}
            </ReactMapGL>
          </div>
          {isPanelOpen && (
            <div className="panel">
              <div className="panel-header">
                <button
                  onClick={() => setIsPanelOpen(false)}
                  style={{ backgroundColor: "black" }}
                >
                  Close
                </button>
              </div>
              <div className="panel-content">
                <h2>Ships Visited at {selectedPort} in last 7 days</h2>
                {shipsVisitedPort.length != 0 ? (
                  <ul>
                    {shipsVisitedPort.map((shipName) => (
                      <li key={shipName}>{shipValue(shipName)}</li>
                    ))}
                  </ul>
                ) : (
                  <h4>No ship Visited here in last 7 days</h4>
                )}
              </div>
            </div>
          )}

          <div className="bottom-bar">
            <button
              className="ship-box"
              onClick={() => setShipClicked(!shipClicked)}
              style={{ color: shipClicked ? "white" : "gray" }}
            >
              <SailingIcon
                xs={{
                  height: "2.5rem",
                  width: "2.5rem",
                }}
              />
              <div className="ship-text">Ship</div>
            </button>

            <button
              className="port-box"
              onClick={() => setShipClicked(!shipClicked)}
              style={{ color: !shipClicked ? "white" : "gray" }}
            >
              <LocationOnIcon />
              <div className="port-text">Port</div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
