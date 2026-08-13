import { StyleSheet } from "react-native";

/**
 * Homepage surfaces share a top-left light source. Utility controls sit close
 * to the page; the primary Add PDF action is elevated further toward the user.
 */
export const homepageDepth = StyleSheet.create({
  control: {
    shadowColor: "#173A21",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 5,
  },
  primary: {
    shadowColor: "#176C34",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.24,
    shadowRadius: 15,
    elevation: 9,
  },
});
