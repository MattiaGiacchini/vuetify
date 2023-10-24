// @ts-nocheck
/* eslint-disable */

import './VTimePickerClock.sass'

import { dateEmits, makeDateProps } from '@/labs/VDateInput/composables'

// Mixins
// import Colorable from '../../mixins/colorable'
// import Themeable from '../../mixins/themeable'

// Types
// import mixins, { ExtractVue } from '../../util/mixins'
// import Vue, { VNode, PropType, VNodeData } from 'vue'
// import { PropValidator } from 'vue/types/options'

// Utilities
import { computed, ref, shallowRef, watch } from 'vue'
import { genericComponent, propsFactory, useRender } from '@/util'

interface Point {
  x: number
  y: number
}

interface options extends Vue {
  $refs: {
    clock: HTMLElement
    innerClock: HTMLElement
  }
}

export const makeVTimePickerClockProps = propsFactory({
  allowedValues: Function as PropType<(value: number) => boolean>,
  ampm: Boolean,
  disabled: Boolean,
  double: Boolean,
  format: {
    type: Function,
    default: (val: string | number) => val,
  } as PropValidator<(val: string | number) => string | number>,
  max: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    required: true,
  },
  scrollable: Boolean,
  readonly: Boolean,
  rotate: {
    type: Number,
    default: 0,
  },
  step: {
    type: Number,
    default: 1,
  },
  value: Number,

  ...makeDateProps(),
}, 'VTimePickerClock')

export const VTimePickerClock = genericComponent()({
  name: 'VTimePickerClock',

  props: makeVTimePickerClockProps(),

  emits: [
    'change',
    'input',
    {
      ...dateEmits,
    }
  ],

  setup (props, { emit, slots }) {
    const clock = ref(null)
    const innerClock = ref(null)
    const inputValue = ref(props.value)
    const isDragging = ref(false)
    const valueOnMouseDown = ref(null as number | null)
    const valueOnMouseUp = ref(null as number | null)

    const count = computed(() => props.max - props.min + 1)
    const degreesPerUnit = computed(() => 360 / roundCount.value)
    const degrees = computed(() => degreesPerUnit.value * Math.PI / 180)
    const displayedValue = computed(() => props.value == null ? props.min : props.value)
    const innerRadiusScale = computed(() => 0.62)
    const roundCount = computed(() => props.double ? (count.value / 2) : count.value)


    const wheel = (e: WheelEvent) => {
      e.preventDefault()

      const delta = Math.sign(-e.deltaY || 1)
      let value = displayedValue.value
      do {
        value = value + delta
        value = (value - props.min + count.value) % count.value + props.min
      } while (!isAllowed(value) && value !== displayedValue.value)

      if (value !== this.displayedValue) {
        this.update(value)
      }
    }
    const isInner = (value: number) => {
      return props.double && (value - props.min >= roundCount.value)
    }
    const handScale = (value: number) => {
      return isInner(value) ? innerRadiusScale.value : 1
    }
    const isAllowed = (value: number) => {
      return !props.allowedValues || props.allowedValues(value)
    }

    const getTransform = (i: number) => {
      const { x, y } = getPosition(i)
      return {
        left: `${50 + x * 50}%`,
        top: `${50 + y * 50}%`,
      }
    }
    const getPosition = (value: number) => {
      const rotateRadians = props.rotate * Math.PI / 180
      return {
        x: Math.sin((value - props.min) * degrees.value + rotateRadians) * handScale(value),
        y: -Math.cos((value - props.min) * degrees.value + rotateRadians) * handScale(value),
      }
    }
    const onMouseDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()

      valueOnMouseDown.value = null
      valueOnMouseUp.value = null
      isDragging.value = true
      onDragMove(e)
    }
    const onMouseUp = (e: MouseEvent | TouchEvent) => {
      e.stopPropagation()

      isDragging.value = false
      if (valueOnMouseUp.value !== null && isAllowed(valueOnMouseUp.value)) {
        emit('change', valueOnMouseUp.value)
      }
    }
    const onDragMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      if ((!isDragging.value && e.type !== 'click') || !clock.value) return

      const { width, top, left } = clock.value.getBoundingClientRect()
      const { width: innerWidth } = innerClock.value.getBoundingClientRect()
      const { clientX, clientY } = 'touches' in e ? e.touches[0] : e
      const center = { x: width / 2, y: -width / 2 }
      const coords = { x: clientX - left, y: top - clientY }
      const handAngle = Math.round(angle(center, coords) - this.rotate + 360) % 360
      const insideClick = props.double && euclidean(center, coords) < (innerWidth + innerWidth * innerRadiusScale.value) / 4
      const checksCount = Math.ceil(15 / degreesPerUnit.value)
      let value

      for (let i = 0; i < checksCount; i++) {
        value = angleToValue(handAngle + i * degreesPerUnit.value, insideClick)
        if (isAllowed(value)) return setMouseDownValue(value)

        value = angleToValue(handAngle - i * degreesPerUnit.value, insideClick)
        if (isAllowed(value)) return setMouseDownValue(value)
      }
    }
    const angleToValue = (angle: number, insideClick: boolean): number => {
      const value = (
        Math.round(angle / degreesPerUnit.value) +
        (insideClick ? roundCount.value : 0)
      ) % count.value + props.min

      // Necessary to fix edge case when selecting left part of the value(s) at 12 o'clock
      if (angle < (360 - degreesPerUnit.value / 2)) return value

      return insideClick ? props.max - roundCount.value + 1 : props.min
    }
    const setMouseDownValue = (value: number) => {
      if (valueOnMouseDown.value === null) {
        valueOnMouseDown.value = value
      }

      valueOnMouseUp.value = value
      update(value)
    }
    const update = (value: number) => {
      if (inputValue.value !== value) {
        inputValue.value = value
        emit('input', value)
      }
    }
    const euclidean = (p0: Point, p1: Point) => {
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y

      return Math.sqrt(dx * dx + dy * dy)
    }
    const angle = (center: Point, p1: Point) => {
      const value = 2 * Math.atan2(p1.y - center.y - euclidean(center, p1), p1.x - center.x)
      return Math.abs(value * 180 / Math.PI)
    }

    const genChildren = computed(() => {
      let children = []
      for (let value = props.min; value <= props.max; value = value + props.step) {
        children.push(value)
      }
      return children
    })
    
    watch(props.value, val => {
      inputValue.value = val
    })

    useRender(() => {
      return (
        <div class={['v-time-picker-clock', { 'v-time-picker-clock--indeterminate': props.value == null } ]}
          onMousedown={ onMouseDown }
          onMouseup={ onMouseUp }
          onMouseleave={ (e: MouseEvent) => (isDragging && onMouseUp(e)) }
          onTouchstart={ onMouseDown }
          onTouchend={ onMouseUp }
          onMousemove={ onDragMove }
          onTouchmove={ onDragMove }
          onWheel={ (e: WheelEvent) => (props.scrollable && wheel(e)) }
          ref="clock"
        >
          <div class="v-time-picker-clock__inner" ref="innerClock">
            <div 
              class={['v-time-picker-clock__hand', {'v-time-picker-clock__hand--inner': isInner(props.value) } ]}
              style={ `background: ${(props.value != null) && (props.color || 'accent')}; transform: rotate(${props.rotate + degreesPerUnit.value * (displayedValue.value - props.min)}deg ${`scaleY(${handScale(displayedValue.value)})`})` }
            ></div>
            {
              genChildren.value.map(value => (
                <div
                  class={[
                    'v-time-picker-clock__item', {
                      'v-time-picker-clock__item--active': value === displayedValue.value,
                      'v-time-picker-clock__item--disabled': props.disabled || !isAllowed(value)
                    }
                  ]}
                  style={ { ...getTransform(value), color: value === props.value && (props.color || 'accent')} }
                ><span>{ props.format(value) }</span></div>
              ))
            }
          </div>
        </div>
      )
    })
  },
})

export type VTimePickerClock = InstanceType<typeof VTimePickerClock>
