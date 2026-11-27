import cityWideRailsData from './cityWideRails.json';

export interface SidewalkWaypoint {
  x: number;
  y: number;
  z: number;
}

export interface SidewalkRail {
  id: string;
  name: string;
  waypoints: SidewalkWaypoint[];
}

export interface CharacterDef {
  id: number;
  name: string;
  activeMeshNames: string[];
  facing: '+X' | '-X';
  modelYawOffset: number;
  localCenterX: number;
  localCenterZ: number;
  height: number;
  defaultIsWalking: boolean;
  walkSpeed: number;
}

export interface StationarySpot {
  charId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export const CHARACTER_DEFS: CharacterDef[] = [
  { id: 0, name: 'Casual Male 01', activeMeshNames: ['Object_7', 'Object_8'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -26.05, localCenterZ: 7.41, height: 0.96, defaultIsWalking: true, walkSpeed: 0.82 },
  { id: 1, name: 'Office Female 01', activeMeshNames: ['Object_10', 'Object_11'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 19.99, localCenterZ: -2.75, height: 0.88, defaultIsWalking: false, walkSpeed: 0 },
  { id: 2, name: 'Smart Male 01', activeMeshNames: ['Object_13', 'Object_14'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -24.79, localCenterZ: -2.93, height: 0.93, defaultIsWalking: false, walkSpeed: 0 },
  { id: 3, name: 'Summer Female 01', activeMeshNames: ['Object_16', 'Object_17'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -44.80, localCenterZ: 1.55, height: 0.89, defaultIsWalking: true, walkSpeed: 0.85 },
  { id: 4, name: 'Street Female 01', activeMeshNames: ['Object_19', 'Object_20'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: -26.48, localCenterZ: -0.66, height: 0.88, defaultIsWalking: false, walkSpeed: 0 },
  { id: 5, name: 'City Female 01', activeMeshNames: ['Object_22', 'Object_23'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: -11.12, localCenterZ: 3.54, height: 0.89, defaultIsWalking: false, walkSpeed: 0 },
  { id: 6, name: 'Walker Male 01', activeMeshNames: ['Object_25', 'Object_26'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 6.07, localCenterZ: 1.96, height: 0.94, defaultIsWalking: true, walkSpeed: 0.88 },
  { id: 7, name: 'Denim Male 01', activeMeshNames: ['Object_28', 'Object_29'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -34.22, localCenterZ: 5.36, height: 0.93, defaultIsWalking: true, walkSpeed: 0.84 },
  { id: 8, name: 'Suit Male 01', activeMeshNames: ['Object_31', 'Object_32'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 5.06, localCenterZ: -3.84, height: 0.95, defaultIsWalking: true, walkSpeed: 0.80 },
  { id: 9, name: 'Walker Male 02', activeMeshNames: ['Object_34', 'Object_35'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -61.01, localCenterZ: 0.22, height: 0.93, defaultIsWalking: true, walkSpeed: 0.86 },
  { id: 10, name: 'Jacket Male 01', activeMeshNames: ['Object_37', 'Object_38'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 23.06, localCenterZ: 6.85, height: 0.93, defaultIsWalking: true, walkSpeed: 0.78 },
  { id: 11, name: 'Walker Male 03', activeMeshNames: ['Object_40', 'Object_41'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -55.13, localCenterZ: 5.12, height: 0.93, defaultIsWalking: true, walkSpeed: 0.85 },
  { id: 12, name: 'Casual Female 02', activeMeshNames: ['Object_43', 'Object_44'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -40.58, localCenterZ: 3.74, height: 0.89, defaultIsWalking: true, walkSpeed: 0.80 },
  { id: 13, name: 'Modern Female 01', activeMeshNames: ['Object_46', 'Object_47'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -50.21, localCenterZ: 10.03, height: 0.90, defaultIsWalking: true, walkSpeed: 0.83 },
  { id: 14, name: 'Trendy Female 01', activeMeshNames: ['Object_49', 'Object_50'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -4.80, localCenterZ: 5.07, height: 0.88, defaultIsWalking: true, walkSpeed: 0.77 },
  { id: 15, name: 'Waiting Female 01', activeMeshNames: ['Object_52', 'Object_53'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 11.38, localCenterZ: 5.98, height: 0.88, defaultIsWalking: false, walkSpeed: 0 },
  { id: 16, name: 'Walking Female 01', activeMeshNames: ['Object_55', 'Object_56'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -2.68, localCenterZ: -5.58, height: 0.90, defaultIsWalking: true, walkSpeed: 0.85 },
  { id: 17, name: 'Urban Male 01', activeMeshNames: ['Object_58', 'Object_59'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -41.93, localCenterZ: -1.13, height: 0.95, defaultIsWalking: true, walkSpeed: 0.82 },
  { id: 18, name: 'Strolling Male 01', activeMeshNames: ['Object_61', 'Object_62'], facing: '-X', modelYawOffset: Math.PI / 2, localCenterX: 10.19, localCenterZ: 0.07, height: 0.93, defaultIsWalking: true, walkSpeed: 0.75 },
  { id: 19, name: 'Cool Male 01', activeMeshNames: ['Object_64', 'Object_65'], facing: '+X', modelYawOffset: -Math.PI / 2, localCenterX: -12.51, localCenterZ: 0.50, height: 0.93, defaultIsWalking: false, walkSpeed: 0 }
];

export const STATIONARY_SPOTS: StationarySpot[] = [
  {
    charId: 2,
    name: "Downtown Storefront Male",
    x: 5.8,
    y: 6.73,
    z: -2,
    heading: -1.2566370614359172
  },
  {
    charId: 4,
    name: "Downtown Storefront Female",
    x: 5.4,
    y: 6.64,
    z: -1.2,
    heading: 1.8849555921538759
  },
  {
    charId: 15,
    name: "Downtown Waiting Female",
    x: 4.2,
    y: 5.76,
    z: 8.5,
    heading: -1.5707963267948966
  },
  {
    charId: 0,
    name: "Downtown Casual Male",
    x: 2.3,
    y: 6.71,
    z: -3.2,
    heading: -2.199114857512855
  },
  {
    charId: 19,
    name: "Corner Cool Male",
    x: 5.55,
    y: 8.06,
    z: -34.15,
    heading: 0.3141592653589793
  },
  {
    charId: 5,
    name: "Corner City Female",
    x: 5.3,
    y: 8.03,
    z: -33.7,
    heading: -2.827433388230814
  },
  {
    charId: 12,
    name: "West Ave 20 Plaza",
    x: -20.21,
    y: 6.24,
    z: -33.29,
    heading: 1.5707963267948966
  },
  {
    charId: 13,
    name: "West Ave 60 Corner",
    x: -60.5,
    y: 3.99,
    z: -36,
    heading: -0.6283185307179586
  },
  {
    charId: 7,
    name: "Far West Ave 240 Chatter Male",
    x: -239.06,
    y: 1.04,
    z: 6.06,
    heading: -1.5707963267948966
  },
  {
    charId: 14,
    name: "Far West Ave 240 Chatter Female",
    x: -239.35,
    y: 1.04,
    z: 6.35,
    heading: 1.5707963267948966
  },
  {
    charId: 13,
    name: "East Ave 25 Corner",
    x: 22.5,
    y: 10.57,
    z: -34,
    heading: -0.9424777960769379
  },
  {
    charId: 17,
    name: "East Ave 45 Storefront",
    x: 46,
    y: 13.36,
    z: -35,
    heading: 1.2566370614359172
  },
  {
    charId: 8,
    name: "East Ave 105 Waiting Suit",
    x: 106,
    y: 17.74,
    z: 5,
    heading: -1.8849555921538759
  },
  {
    charId: 3,
    name: "Far East Ave 250 Summer Female",
    x: 248,
    y: 30.01,
    z: -35,
    heading: -2.5132741228718345
  },
  {
    charId: 9,
    name: "North Street 120 Walker",
    x: 5,
    y: 12.02,
    z: -121.5,
    heading: 3.141592653589793
  },
  {
    charId: 6,
    name: "North Street 210 Walker",
    x: -17.88,
    y: 15.86,
    z: -207.88,
    heading: 0
  },
  {
    charId: 16,
    name: "Far North Plaza Female",
    x: 23.35,
    y: 22.49,
    z: -259.65,
    heading: 1.5707963267948966
  },
  {
    charId: 11,
    name: "South Street 85 Resident",
    x: 4.29,
    y: 4.01,
    z: 84.29,
    heading: -1.5707963267948966
  }
];

export const SIDEWALK_RAILS: SidewalkRail[] = cityWideRailsData as SidewalkRail[];
