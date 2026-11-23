/* The service rig uses the wrist as its origin in all three poses. */
(function (global) {
  'use strict';
  function build(T, makeSection, skin) {
    const parts = {};
    for (const side of [-1, 1]) {
      const wrist = new T.Vector3(side * .324, .974, .069);
      const point = (inward, height, front) => new T.Vector3(
        wrist.x - side * inward, wrist.y + height, wrist.z + front
      );
      for (const writing of [false, true]) {
        const section = makeSection();
        // The palm and each digit are continuous tapered surfaces, including
        // the knuckle and fingertip. Their curves meet inside the palm.
        function flesh(points, widths, depths, across, nail) {
          const path = new T.CatmullRomCurve3(points.map(p => point(...p)));
          const positions = [], colors=[], indices = [], sides = 18, rings = (widths.length - 1) * 5;
          const complexion=new T.Color(skin).convertSRGBToLinear();
          const knuckle=new T.Color('#C18C78').convertSRGBToLinear(),shade=new T.Color('#AD7E6C').convertSRGBToLinear();
          const paint=new T.Color();
          const centre = new T.Vector3(), tangent = new T.Vector3();
          const lateral = new T.Vector3(), normal = new T.Vector3();
          function sample(t) {
            path.getPoint(t, centre); path.getTangent(t, tangent);
            lateral.copy(across).addScaledVector(tangent, -across.dot(tangent)).normalize();
            normal.crossVectors(tangent, lateral).normalize();
          }
          for (let row = 0; row <= rings; row++) {
            const t=row/rings;
            sample(t);
            const i = Math.min(widths.length - 2, Math.floor(row / 5)), f = row / 5 - i;
            const w = T.MathUtils.lerp(widths[i], widths[i + 1], f);
            const d = T.MathUtils.lerp(depths[i], depths[i + 1], f);
            for (let j = 0; j < sides; j++) {
              const a = 2 * Math.PI * j / sides, offset = centre.clone()
                .addScaledVector(lateral, w * Math.cos(a)).addScaledVector(normal, d * Math.sin(a));
              positions.push(offset.x, offset.y, offset.z);
              const back=Math.max(0,Math.sin(a)*normal.y+Math.cos(a)*lateral.y);
              const joints=nail ? Math.exp(-(((t-.45)/.105)**2))+.72*Math.exp(-(((t-.69)/.09)**2)) : .36;
              const crease=nail ? Math.exp(-(((t-.48)/.032)**2))+.58*Math.exp(-(((t-.72)/.037)**2)) : 0;
              paint.copy(complexion).lerp(knuckle,.32*joints+.14*t**3).lerp(shade,.27*back*crease);
              colors.push(paint.r,paint.g,paint.b);
              if (row < rings) {
                const k = row * sides + j, next = row * sides + (j + 1) % sides;
                indices.push(k, next, k + sides, next, next + sides, k + sides);
              }
            }
          }
          const geo = new T.BufferGeometry();
          geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
          geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
          geo.setIndex(indices); geo.computeVertexNormals();
          section.part(geo, '#FFFFFF'); geo.dispose();
          if (!nail) return;
          sample(.80);
          if (normal.y < 0) normal.negate();
          centre.addScaledVector(normal, depths[depths.length - 2] * .86);
          lateral.crossVectors(normal, tangent).normalize();
          normal.crossVectors(tangent, lateral).normalize();
          const angles = new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(lateral, normal, tangent));
          section.oval('#DDAF99', centre.x, centre.y, centre.z, nail, .0018, nail * 1.32,
            angles.x, angles.y, angles.z);
        }
        const transverse = new T.Vector3(0, 0, 1);
        flesh([[-.035,.020,-.007],[-.012,.006,-.006],[.010,0,-.005],[.034,.001,-.003],[.050,.004,0],[.063,.006,.002]],
          [.023,.041,.045,.047,.042,.008], [.022,.029,.028,.024,.016,.005], transverse);
        for (let j = 0; j < 4; j++) {
          const z = .032 - j * .021, len = [.073,.082,.076,.061][j];
          const r = [.0118,.0121,.0114,.0098][j];
          let joints;
          if (!writing) {
            joints = [[.035,.005,z],[.052,.007,z],[.052+.32*len,.014,z+.002],
              [.052+.57*len,.020,z+.004],[.052+.67*len,.021,z+.003]];
          } else if (side === 1 && j === 0) {
            joints = [[.034,.009,z],[.045,.026,.047],[.053,.048,.049],[.063,.039,.043],[.063,.032,.043]];
          } else if (side === 1) {
            joints = [[.031,.005,z],[.055,.018,z+.005],[.077-.003*j,.021,z+.007],
              [.073-.003*j,.009,z+.012],[.064-.002*j,.006,z+.013]];
          } else {
            joints = [[.034,.003,z],[.052,.008,z],[.071,.015,z+.002],
              [.079,.024,z+.005],[.081,.030,z+.006]];
          }
          flesh(joints,[.78*r,r,.88*r,.77*r,.0013],[.82*r,r,.89*r,.83*r,.0013],transverse,r*.59);
        }
        const thumb = writing ? [[-.007,.006,.021],[.005,.018,.039],[.021,.034,.054],[.039,.032,.055],[.051,.025,.044]]
          : [[-.009,.004,.022],[.002,.016,.040],[.016,.034,.059],[.034,.044,.062],[.045,.045,.056]];
        flesh(thumb,[.022,.021,.017,.013,.0016],[.021,.020,.016,.012,.0016],new T.Vector3(side,0,0),.0086);
        const geometry = section.finishMesh().geometry;
        parts[(writing ? 'noteHand' : 'hand') + side] = geometry;
        if (!writing) {
          const rest = geometry.clone();
          rest.translate(-wrist.x, -wrist.y, -wrist.z);
          rest.rotateZ(side * 1.22); rest.rotateX(-.12);
          rest.translate(wrist.x, wrist.y, wrist.z); rest.computeBoundingSphere();
          parts['restHand' + side] = rest;
        }
      }
    }
    return parts;
  }
  global.DinerOwnerHands = {build};
})(window);
